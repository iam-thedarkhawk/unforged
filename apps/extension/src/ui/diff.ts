// The diff panel's model: which blocked file to compare, and the lines to show. Pure, so it is
// unit-tested directly. Both bodies are attacker-controlled: they stay plain strings here, and
// diff-panel.ts puts them in text nodes.
import type { Blocked } from "@unforged/core";
import { createTwoFilesPatch } from "diff";
import beautify from "js-beautify";

export const MAX_DIFF_LINES = 400;
export const MAX_LINE_CHARS = 2000;
const DIFF_TIMEOUT_MS = 4000;
const MINUS_SIGN = "−";

export type CodeKind = "js" | "css" | "html";
export type LineKind = "header" | "hunk" | "added" | "removed" | "context";

export interface DiffLine {
  kind: LineKind;
  text: string;
}

export interface DiffModel {
  lines: DiffLine[]; // at most MAX_DIFF_LINES
  added: number; // in the whole diff, shown or not
  removed: number;
  hiddenLines: number;
}

export type DiffView = DiffModel | { error: string };

const KIND_BY_EXTENSION: Record<string, CodeKind> = { js: "js", mjs: "js", css: "css", html: "html", htm: "html" };

/** How to read a file, from its URL. A path with no extension is a route, so a page. */
export function codeKindOf(url: string): CodeKind | undefined {
  try {
    const name = new URL(url).pathname.split("/").pop() ?? "";
    const dot = name.lastIndexOf(".");
    return dot === -1 ? "html" : KIND_BY_EXTENSION[name.slice(dot + 1).toLowerCase()];
  } catch {
    return undefined;
  }
}

/** The first blocked file that has a verified twin to compare with. */
export function firstDiffable(blocked: readonly Blocked[]): { entry: Blocked; kind: CodeKind } | undefined {
  for (const entry of blocked) {
    const kind = codeKindOf(entry.url);
    if (entry.reason === "hash-mismatch" && kind) return { entry, kind };
  }
  return undefined;
}

export function prettyPrint(kind: CodeKind, text: string): string {
  return beautify[kind](text, { indent_size: 2, eol: "\n", end_with_newline: true });
}

function capLine(text: string): string {
  return text.length > MAX_LINE_CHARS ? `${text.slice(0, MAX_LINE_CHARS)}…` : text;
}

/** One line inside a hunk. Every content line has a prefix, so content can't pose as a header. */
function hunkLine(line: string): DiffLine {
  if (line.startsWith("@@")) return { kind: "hunk", text: line };
  if (line.startsWith("+")) return { kind: "added", text: line };
  if (line.startsWith("-")) return { kind: "removed", text: MINUS_SIGN + line.slice(1) };
  return { kind: "context", text: line };
}

/** Sorts a unified patch into lines. Headers exist only before the first hunk. */
export function classifyPatch(patch: string): DiffLine[] {
  const lines = patch.split("\n");
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  const headerEnd = firstHunk === -1 ? lines.length : firstHunk;
  const headers = lines
    .slice(0, headerEnd)
    .filter((line) => line.startsWith("---") || line.startsWith("+++"))
    .map((text): DiffLine => ({ kind: "header", text: text.trimEnd() }));
  const body = lines.slice(headerEnd).filter((line) => line !== "");
  return [...headers, ...body.map(hunkLine)];
}

function withFinalNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function count(lines: readonly DiffLine[], kind: LineKind): number {
  return lines.filter((line) => line.kind === kind).length;
}

/** The whole comparison: pretty-print both sides, diff them, cap what is shown. */
export function buildDiffView(verified: string, served: string, kind: CodeKind): DiffView {
  if (verified.trim() === "") return { error: "The verified copy is empty, so there is nothing to compare." };
  if (served.trim() === "") return { error: "The served file is empty, so there is nothing to compare." };
  const patch = createTwoFilesPatch(
    "verified copy",
    "served",
    withFinalNewline(prettyPrint(kind, verified)),
    withFinalNewline(prettyPrint(kind, served)),
    undefined,
    undefined,
    { context: 3, timeout: DIFF_TIMEOUT_MS },
  );
  if (patch === undefined) return { error: "These two files are too different to compare here." };
  const all = classifyPatch(patch);
  const added = count(all, "added");
  const removed = count(all, "removed");
  if (added + removed === 0) return { lines: [], added, removed, hiddenLines: 0 };
  const lines = all.slice(0, MAX_DIFF_LINES).map((line) => ({ ...line, text: capLine(line.text) }));
  return { lines, added, removed, hiddenLines: all.length - lines.length };
}

/** Reasons come from the background or the network, and may already end in a full stop. */
export function unavailableText(side: string, reason: string): string {
  return `${side} isn't available: ${reason.replace(/\.+$/, "")}.`;
}

export function summaryText({ added, removed }: DiffModel): string {
  if (added + removed === 0) return "The two files differ only in formatting or invisible characters.";
  return `${added} ${added === 1 ? "line" : "lines"} added, ${removed} removed`;
}
