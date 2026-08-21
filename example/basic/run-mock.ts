/**
 * Offline basic example — mock ModelClient, no API key.
 *
 *   cd example && npm run basic:mock
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Harness } from "mxpf-ai-harness";
import type { ModelClient, ModelCompleteResponse } from "mxpf-ai-harness";

// ModelClient is not re-exported as a value — import types from package path after build.
// For the example we inject via a private field after create (same pattern as unit tests).

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

const cwd = mkdtempSync(join(tmpdir(), "mxpf-ex-"));
const sessionDir = mkdtempSync(join(tmpdir(), "mxpf-ex-sess-"));
writeFileSync(join(cwd, "hello.txt"), "Hello from mxpf-ai-harness example\n", "utf8");

try {
  const harness = await Harness.create({
    cwd,
    sessionDir,
    model: { provider: "openai", id: "mock", apiKey: "unused" },
    tools: { mcp: false },
    fetch: async () => {
      throw new Error("network disabled in mock example");
    },
  });

  (harness as unknown as { model: ModelClient }).model = mockModel([
    {
      content: [
        {
          type: "tool_use",
          id: "1",
          name: "Read",
          input: { path: "hello.txt" },
        },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 5, outputTokens: 5 },
    },
    {
      content: [{ type: "text", text: "The file says: Hello from mxpf-ai-harness example" }],
      stopReason: "end_turn",
      rawText: "The file says: Hello from mxpf-ai-harness example",
      usage: { inputTokens: 8, outputTokens: 12 },
    },
  ]);

  console.log("session:", harness.sessionId);
  const run = await harness.send("Read hello.txt and tell me what it says.");
  for await (const ev of run.stream()) {
    if (ev.type === "tool.start") console.log("tool →", ev.name, ev.input);
    if (ev.type === "tool.result") console.log("tool ←", ev.output.slice(0, 120));
    if (ev.type === "assistant.text") console.log("text:", ev.text);
  }
  const result = await run.wait();
  console.log("done:", result.status, result.result);
  await harness[Symbol.asyncDispose]();
} finally {
  rmSync(cwd, { recursive: true, force: true });
  rmSync(sessionDir, { recursive: true, force: true });
}
