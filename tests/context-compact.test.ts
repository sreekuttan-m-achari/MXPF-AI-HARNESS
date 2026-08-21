import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compactMessages,
  estimateChars,
} from "../src/context/compact.js";
import type { InternalMessage } from "../src/model/types.js";

describe("compactMessages", () => {
  it("leaves messages unchanged when under budget", () => {
    const messages: InternalMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];
    const out = compactMessages(messages, {
      maxInputChars: 10_000,
      keepRecentTurns: 6,
    });
    assert.equal(out.compacted, false);
    assert.deepEqual(out.messages, messages);
  });

  it("inserts summary and keeps recent rounds when over budget", () => {
    const messages: InternalMessage[] = [];
    for (let i = 0; i < 10; i++) {
      messages.push({ role: "user", content: `user turn ${i} ` + "x".repeat(500) });
      messages.push({
        role: "assistant",
        content: `assistant turn ${i} ` + "y".repeat(500),
      });
    }
    const before = estimateChars(messages);
    assert.ok(before > 5_000);

    const out = compactMessages(messages, {
      maxInputChars: 5_000,
      keepRecentTurns: 2,
    });
    assert.equal(out.compacted, true);
    assert.equal(out.messages[0]?.role, "user");
    assert.match(String(out.messages[0]?.content ?? ""), /context summary/);
    const after = estimateChars(out.messages);
    assert.ok(after < before);
    // Last user content should still be present
    const flat = JSON.stringify(out.messages);
    assert.match(flat, /user turn 9/);
  });
});
