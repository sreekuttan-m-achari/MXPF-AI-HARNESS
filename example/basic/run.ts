/**
 * Live basic example — one harness turn over the parent repo cwd.
 *
 *   cd example && npm run basic
 */
import "dotenv/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Harness } from "mxpf-ai-harness";

import { enableLangSmithIfConfigured } from "../langsmith.js";

enableLangSmithIfConfigured();

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const apiKey = process.env.MXPF_HARNESS_API_KEY?.trim();
if (!apiKey) {
  console.error("Set MXPF_HARNESS_API_KEY (see .env.sample) or use: npm run basic:mock");
  process.exit(1);
}

const provider =
  process.env.MXPF_HARNESS_PROVIDER === "openai" ? "openai" : "anthropic";
const modelId =
  process.env.MXPF_HARNESS_MODEL?.trim() ||
  (provider === "openai" ? "gpt-4.1" : "claude-sonnet-4-5");

const harness = await Harness.create({
  cwd: root,
  model: {
    provider,
    id: modelId,
    apiKey,
    baseURL: process.env.MXPF_HARNESS_BASE_URL?.trim() || undefined,
    maxOutputTokens: 2048,
  },
  systemPrompt:
    "You are a concise coding agent. Prefer Read/Glob before answering. Keep answers short.",
  permissions: { mode: "bypass" },
  tools: { mcp: false },
  context: {
    autoCompact: true,
    toolResultMaxChars: 16_000,
    readDefaultMaxChars: 40_000,
  },
  throughput: {
    parallelTools: true,
    promptCache: true,
  },
});

console.log(
  `session=${harness.sessionId} model=${provider}/${modelId} harness=0.2 opts=autoCompact+caps`,
);

const run = await harness.send(
  "Using tools, list *.md files at the repo root and quote the first heading of README.md.",
);

for await (const ev of run.stream()) {
  if (ev.type === "assistant.text") process.stdout.write(ev.text);
  if (ev.type === "tool.start") console.log(`\n→ tool ${ev.name}`);
  if (ev.type === "tool.result")
    console.log(`← ${ev.name}${ev.isError ? " (error)" : ""} (${ev.output.length} chars)`);
  if (ev.type === "status" && ev.detail)
    console.log(`\n· status ${ev.status}: ${ev.detail}`);
  if (ev.type === "usage") console.log(`\n· usage so far:`, ev.usage);
  if (ev.type === "error") console.error("\nerror:", ev.message);
}

const result = await run.wait();
console.log("\n\nstatus:", result.status, "usage:", result.usage);
await harness[Symbol.asyncDispose]();
