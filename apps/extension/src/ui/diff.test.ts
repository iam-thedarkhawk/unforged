import { describe, expect, it } from "vitest";
import type { Blocked } from "@unforged/core";
import {
  MAX_DIFF_LINES,
  MAX_LINE_CHARS,
  buildDiffView,
  classifyPatch,
  codeKindOf,
  firstDiffable,
  prettyPrint,
  summaryText,
  unavailableText,
  type DiffLine,
  type DiffView,
} from "./diff.js";

const ORIGIN = "http://localhost:8080";

function linesOf(view: DiffView): DiffLine[] {
  if ("error" in view) throw new Error(`expected a diff, got: ${view.error}`);
  return view.lines;
}

function ofKind(view: DiffView, kind: DiffLine["kind"]): string[] {
  return linesOf(view)
    .filter((line) => line.kind === kind)
    .map((line) => line.text);
}

function numbered(count: number): string {
  return Array.from({ length: count }, (_, i) => `const line${i} = ${i};`).join("\n") + "\n";
}

describe("buildDiffView", () => {
  it("shows an appended line as one + line", () => {
    const view = buildDiffView("const a = 1;\n", "const a = 1;\nconst evil = 2;\n", "js");
    expect(ofKind(view, "added")).toEqual(["+const evil = 2;"]);
    expect(ofKind(view, "removed")).toEqual([]);
    expect(view).toMatchObject({ added: 1, removed: 0, hiddenLines: 0 });
  });

  it("shows an appended line as one + line when neither side ends in a newline", () => {
    const view = buildDiffView("const a = 1;", "const a = 1;\nconst evil = 2;", "js");
    expect(ofKind(view, "added")).toEqual(["+const evil = 2;"]);
    expect(ofKind(view, "removed")).toEqual([]);
  });

  it("marks removed lines with a minus sign and labels the two sides", () => {
    const view = buildDiffView("const a = 1;\nconst b = 2;\n", "const a = 1;\n", "js");
    expect(ofKind(view, "removed")).toEqual(["−const b = 2;"]);
    expect(ofKind(view, "context")).toEqual([" const a = 1;"]);
    expect(ofKind(view, "header")).toEqual(["--- verified copy", "+++ served"]);
  });

  it("pretty-prints both sides, so minified code diffs line by line", () => {
    const view = buildDiffView("function f(){return 1}", "function f(){return 2}", "js");
    expect(ofKind(view, "added")).toEqual(["+  return 2"]);
    expect(ofKind(view, "removed")).toEqual(["−  return 1"]);
  });

  it("caps the lines shown but still counts all of them", () => {
    const view = buildDiffView("const a = 1;\n", `const a = 1;\n${numbered(10_000)}`, "js");
    const lines = linesOf(view);
    expect(lines).toHaveLength(MAX_DIFF_LINES);
    expect(view).toMatchObject({ added: 10_000, removed: 0 });
    expect(view).toHaveProperty("hiddenLines", 10_000 + 4 - MAX_DIFF_LINES); // 2 headers, hunk, context
  });

  it("caps a single huge line", () => {
    const view = buildDiffView("const a = 1;\n", `const a = 1;\nconst s = "${"x".repeat(100_000)}";\n`, "js");
    const [added] = ofKind(view, "added");
    expect(added).toHaveLength(MAX_LINE_CHARS + 1);
    expect(added?.endsWith("…")).toBe(true);
  });

  it("gives the error state when a side is empty", () => {
    expect(buildDiffView("", "const a = 1;\n", "js")).toEqual({ error: expect.stringContaining("verified copy is empty") });
    expect(buildDiffView("const a = 1;\n", "", "js")).toEqual({ error: expect.stringContaining("served file is empty") });
    expect(buildDiffView("const a = 1;\n", " \n", "js")).toHaveProperty("error");
  });

  it("reports no line changes when only the formatting differs", () => {
    const view = buildDiffView("const a = 1;\n", "const   a=1;\n", "js");
    expect(view).toMatchObject({ lines: [], added: 0, removed: 0 });
  });
});

describe("classifyPatch", () => {
  it("doesn't let file content pose as a patch header or hunk", () => {
    const patch = [
      "===================================================================",
      "--- verified copy",
      "+++ served",
      "@@ -1,2 +1,2 @@",
      "--- verified copy",
      "+++ served",
      "+@@ -1 +1 @@",
      " --- context",
    ].join("\n");
    expect(classifyPatch(patch)).toEqual([
      { kind: "header", text: "--- verified copy" },
      { kind: "header", text: "+++ served" },
      { kind: "hunk", text: "@@ -1,2 +1,2 @@" },
      { kind: "removed", text: "−-- verified copy" },
      { kind: "added", text: "+++ served" },
      { kind: "added", text: "+@@ -1 +1 @@" },
      { kind: "context", text: " --- context" },
    ]);
  });

  it("keeps markup as plain text", () => {
    const markup = '<img src=x onerror="alert(1)">';
    const view = buildDiffView("<p>a</p>\n", `<p>a</p>\n${markup}\n`, "html");
    expect(ofKind(view, "added")).toEqual([`+${markup}`]);
  });
});

describe("prettyPrint", () => {
  it("formats by kind", () => {
    expect(prettyPrint("css", "a{color:red}")).toBe("a {\n  color: red\n}\n");
    expect(prettyPrint("js", "if(a){b()}")).toBe("if (a) {\n  b()\n}\n");
    expect(prettyPrint("html", "<div><p>a</p></div>")).toContain("\n  <p>a</p>\n");
  });
});

describe("codeKindOf", () => {
  it("picks the kind from the path", () => {
    expect(codeKindOf(`${ORIGIN}/_next/a.js?v=1`)).toBe("js");
    expect(codeKindOf(`${ORIGIN}/a.mjs`)).toBe("js");
    expect(codeKindOf(`${ORIGIN}/a.css`)).toBe("css");
    expect(codeKindOf(`${ORIGIN}/`)).toBe("html");
    expect(codeKindOf(`${ORIGIN}/index.html`)).toBe("html");
    expect(codeKindOf(`${ORIGIN}/earn`)).toBe("html");
  });

  it("has no kind for anything else", () => {
    expect(codeKindOf(`${ORIGIN}/logo.png`)).toBeUndefined();
    expect(codeKindOf("not a url")).toBeUndefined();
  });
});

describe("firstDiffable", () => {
  const entry = (path: string, reason: Blocked["reason"]): Blocked => ({ url: `${ORIGIN}${path}`, reason, actual: "a" });

  it("takes the first hash-mismatch with a known kind", () => {
    const blocked = [
      entry("/extra.js", "unknown-file"),
      entry("/evil.js", "third-party"),
      entry("/data.json", "hash-mismatch"),
      entry("/b.css", "hash-mismatch"),
      entry("/c.js", "hash-mismatch"),
    ];
    expect(firstDiffable(blocked)).toEqual({ entry: blocked[3], kind: "css" });
  });

  it("includes a blocked start page", () => {
    const blocked = [entry("/", "hash-mismatch")];
    expect(firstDiffable(blocked)).toEqual({ entry: blocked[0], kind: "html" });
  });

  it("finds nothing when no file has a verified twin", () => {
    expect(firstDiffable([entry("/extra.js", "unknown-file")])).toBeUndefined();
  });
});

describe("summaryText", () => {
  it("counts lines", () => {
    expect(summaryText({ lines: [], added: 3, removed: 1, hiddenLines: 0 })).toBe("3 lines added, 1 removed");
    expect(summaryText({ lines: [], added: 1, removed: 0, hiddenLines: 0 })).toBe("1 line added, 0 removed");
  });

  it("explains a difference that formatting hides", () => {
    expect(summaryText({ lines: [], added: 0, removed: 0, hiddenLines: 0 })).toContain("only in formatting");
  });
});

describe("unavailableText", () => {
  it("ends in one full stop, whatever the reason ends in", () => {
    expect(unavailableText("The verified copy", "mirror copy doesn't match")).toBe("The verified copy isn't available: mirror copy doesn't match.");
    expect(unavailableText("The served file", "network failed.")).toBe("The served file isn't available: network failed.");
  });
});
