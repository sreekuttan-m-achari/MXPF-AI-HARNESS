/**
 * Offline A/B: same tool-heavy turn with / without v0.2 context caps.
 * Measures estimated message chars the model would see (no network).
 *
 *   cd example && npx tsx basic/compare-tokens.ts
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Harness, estimateChars } from "mxpf-ai-harness";
import type { ModelClient, ModelCompleteResponse } from "mxpf-ai-harness";

function mockModel(script: ModelCompleteResponse[]): ModelClient {
  let i = 0;
  return {
    provider: "openai",
    modelId: "mock",
    async complete(req) {
      const next = script[i++];
      if (!next) throw new Error("unexpected model call");
      // stash last request size on the response via side channel
      (next as { _reqChars?: number })._reqChars = estimateChars(req.messages);
      return next;
    },
  };
}

async function runOnce(label: string, optimized: boolean) {
  const dir = mkdtempSync(join(tmpdir(), "mxpf-cmp-"));
  const sess = mkdtempSync(join(tmpdir(), "mxpf-cmps-"));
  // ~80k chars of "file" content — would dominate history without caps
  const blob = ("LINE " + "x".repeat(200) + "\n").repeat(400);
  writeFileSync(join(dir, "big.md"), `# Big\n\n${blob}`, "utf8");
  writeFileSync(join(dir, "README.md"), "# Title\n\nhello", "utf8");

  try {
    const harness = await Harness.create({
      cwd: dir,
      sessionDir: sess,
      model: { provider: "openai", id: "mock", apiKey: "x" },
      tools: { mcp: false },
      systemPrompt: "Be concise.",
      ...(optimized
        ? {
            context: {
              autoCompact: true,
              toolResultMaxChars: 16_000,
              readDefaultMaxChars: 16_000,
            },
            throughput: { parallelTools: true },
          }
        : {
            context: {
              toolResultMaxChars: 2_000_000,
              readDefaultMaxChars: 2_000_000,
              bashMaxChars: 2_000_000,
            },
            throughput: { parallelTools: false },
          }),
      fetch: async () => {
        throw new Error("no network");
      },
    });

    const script: ModelCompleteResponse[] = [
      {
        content: [
          {
            type: "tool_use",
            id: "1",
            name: "Read",
            input: { path: "big.md" },
          },
          {
            type: "tool_use",
            id: "2",
            name: "Read",
            input: { path: "README.md" },
          },
        ],
        stopReason: "tool_use",
        usage: { inputTokens: 100, outputTokens: 20 },
      },
      {
        content: [{ type: "text", text: "Done." }],
        stopReason: "end_turn",
        rawText: "Done.",
        usage: { inputTokens: 50, outputTokens: 5 },
      },
    ];

    const anyH = harness as unknown as { model: ModelClient };
    anyH.model = mockModel(script);

    const run = await harness.send(
      "Read big.md and README.md, then summarize headings.",
    );
    let toolChars = 0;
    for await (const ev of run.stream()) {
      if (ev.type === "tool.result") toolChars += ev.output.length;
    }
    const result = await run.wait();
    const sessionChars = estimateChars(
      (harness as unknown as { session: { getMessages: () => unknown[] } })
        .session
        ? (
            harness as unknown as {
              session: { getMessages: () => Parameters<typeof estimateChars>[0] };
            }
          ).session.getMessages()
        : [],
    );

    // Turn-2 request size is what matters after tools land in history
    const turn2 = script[1] as ModelCompleteResponse & { _reqChars?: number };

    console.log(`\n=== ${label} ===`);
    console.log("status:", result.status);
    console.log("tool.result total chars:", toolChars);
    console.log("session estimateChars:", sessionChars);
    console.log("turn-2 model request estimateChars:", turn2._reqChars);
    console.log("reported usage:", result.usage);
    await harness[Symbol.asyncDispose]();
    return { toolChars, sessionChars, turn2: turn2._reqChars ?? 0 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(sess, { recursive: true, force: true });
  }
}

const baseline = await runOnce("0.1-style (huge caps, serial)", false);
const optimized = await runOnce("0.2 optimized (16k caps, parallel)", true);

const save =
  baseline.turn2 > 0
    ? (((baseline.turn2 - optimized.turn2) / baseline.turn2) * 100).toFixed(1)
    : "?";
console.log(`\nΔ turn-2 prompt chars: ${baseline.turn2} → ${optimized.turn2} (−${save}%)`);
console.log(
  `Δ tool outputs: ${baseline.toolChars} → ${optimized.toolChars}`,
);
