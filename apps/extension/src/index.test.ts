import { describe, expect, it } from "vitest";
import * as mod from "./index.js";

describe("@unforged/extension", () => {
  it("loads", () => {
    expect(mod).toBeDefined();
  });
});
