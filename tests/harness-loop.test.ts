import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { Harness } from "../src/harness.js";
import type { ModelClient, ModelCompleteResponse } from "../src/model/types.js";
import type { ContentBlock } from "../src/model/types.js";

function mockModel(script: ModelCompleteResponse[]): ModelClient {
  let i = 0;
  return {
    provider: "openai",
    modelId: "mock",
    async complete() {
      const next = script[i++];
      if (!next) throw new Error("unexpected model call");
      return next;
    },
  };
}

describe("Harness loop", () => {
  it("runs tool then finishes with mock model", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mxpf-h-"));
    const sess = mkdtempSync(join(tmpdir(), "mxpf-hs-"));
    try {
      writeFileSync(join(dir, "note.txt"), "payload", "utf8");

      const toolUse: ContentBlock[] = [
        {
          type: "tool_use",
          id: "1",
          name: "Read",
          input: { path: "note.txt" },
        },
      ];
      const final: ContentBlock[] = [
        { type: "text", text: "Found payload" },
      ];

      const harness = await Harness.create({
        cwd: dir,
        sessionDir: sess,
        model: {
          provider: "openai",
          id: "mock",
          apiKey: "x",
        },
        tools: { mcp: false },
        fetch: async () => {
          throw new Error("network should not be used");
        },
      });

      // Inject mock model by reaching into private field via cast for test
      const anyH = harness as unknown as { model: ModelClient };
      anyH.model = mockModel([
        {
          content: toolUse,
          stopReason: "tool_use",
          usage: { inputTokens: 1, outputTokens: 1 },
        },
        {
          content: final,
          stopReason: "end_turn",
          rawText: "Found payload",
          usage: { inputTokens: 2, outputTokens: 2 },
        },
      ]);

      const run = await harness.send("read the note");
      const texts: string[] = [];
      for await (const ev of run.stream()) {
        if (ev.type === "assistant.text") texts.push(ev.text);
      }
      const result = await run.wait();
      assert.equal(result.status, "finished");
      assert.match(result.result ?? "", /Found payload/);
      assert.ok(texts.join("").includes("Found payload"));
      await harness[Symbol.asyncDispose]();
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(sess, { recursive: true, force: true });
    }
  });

  it("runs parallel tool calls and preserves result order", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mxpf-h-par-"));
    const sess = mkdtempSync(join(tmpdir(), "mxpf-hs-par-"));
    try {
      writeFileSync(join(dir, "a.txt"), "AAA", "utf8");
      writeFileSync(join(dir, "b.txt"), "BBB", "utf8");

      const harness = await Harness.create({
        cwd: dir,
        sessionDir: sess,
        model: { provider: "openai", id: "mock", apiKey: "x" },
        tools: { mcp: false },
        throughput: { parallelTools: true },
        fetch: async () => {
          throw new Error("network should not be used");
        },
      });

      const anyH = harness as unknown as { model: ModelClient };
      anyH.model = mockModel([
        {
          content: [
            {
              type: "tool_use",
              id: "t1",
              name: "Read",
              input: { path: "a.txt" },
            },
            {
              type: "tool_use",
              id: "t2",
              name: "Read",
              input: { path: "b.txt" },
            },
          ],
          stopReason: "tool_use",
        },
        {
          content: [{ type: "text", text: "done" }],
          stopReason: "end_turn",
          rawText: "done",
        },
      ]);

      const run = await harness.send("read both");
      const results: Array<{ id: string; output: string }> = [];
      for await (const ev of run.stream()) {
        if (ev.type === "tool.result") {
          results.push({ id: ev.toolCallId, output: ev.output });
        }
      }
      const result = await run.wait();
      assert.equal(result.status, "finished");
      assert.equal(results.length, 2);
      assert.equal(results[0]?.id, "t1");
      assert.equal(results[1]?.id, "t2");
      assert.match(results[0]?.output ?? "", /AAA/);
      assert.match(results[1]?.output ?? "", /BBB/);
      await harness[Symbol.asyncDispose]();
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(sess, { recursive: true, force: true });
    }
  });

  it("reports supports() matrix", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mxpf-h2-"));
    const sess = mkdtempSync(join(tmpdir(), "mxpf-hs2-"));
    try {
      const harness = await Harness.create({
        cwd: dir,
        sessionDir: sess,
        model: { provider: "openai", id: "m", apiKey: "x" },
        tools: { mcp: false },
        fetch: async () => new Response("{}", { status: 500 }),
      });
      assert.equal(harness.supports("tools"), true);
      assert.equal(harness.supports("subagents"), false);
      await harness[Symbol.asyncDispose]();
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(sess, { recursive: true, force: true });
    }
  });
});
