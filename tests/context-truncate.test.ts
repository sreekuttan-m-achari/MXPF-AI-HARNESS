import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { truncateToolResult } from "../src/context/truncate.js";

describe("truncateToolResult", () => {
  it("returns text unchanged when under budget", () => {
    assert.equal(truncateToolResult("hello", 100), "hello");
  });

  it("keeps head and tail when over budget", () => {
    const text = "A".repeat(1000) + "ERROR_TAIL_MARKER" + "B".repeat(100);
    const out = truncateToolResult(text, 200);
    assert.ok(out.length <= 280);
    assert.match(out, /truncated: kept/);
    assert.ok(out.includes("ERROR_TAIL_MARKER") || out.endsWith("B".repeat(50)) || out.includes("B"));
    assert.ok(out.startsWith("A"));
  });
});
