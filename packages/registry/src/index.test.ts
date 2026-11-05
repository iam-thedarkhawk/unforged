import { describe, expect, it } from "vitest";
import * as mod from "./index.js";

describe("@unforged/registry", () => {
  it("loads", () => {
    expect(mod).toBeDefined();
  });
});
