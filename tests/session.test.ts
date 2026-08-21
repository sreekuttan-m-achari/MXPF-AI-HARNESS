import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { SessionStore } from "../src/session/store.js";

describe("SessionStore", () => {
  it("creates and resumes messages", () => {
    const dir = mkdtempSync(join(tmpdir(), "mxpf-sess-"));
    try {
      const s1 = SessionStore.create(dir);
      s1.append({ role: "user", content: "hello" });
      const s2 = SessionStore.resume(dir, s1.sessionId);
      assert.equal(s2.sessionId, s1.sessionId);
      assert.equal(s2.getMessages().length, 1);
      assert.equal(
        (s2.getMessages()[0] as { content: string }).content,
        "hello",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
