import { describe, expect, it } from "vitest";
import * as mod from "./index.js";

describe("@unforged/cli", () => {
  it("loads", () => {
    expect(mod).toBeDefined();
  });
});
