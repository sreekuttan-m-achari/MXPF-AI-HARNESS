/**
 * Live LangGraph + harness example.
 *
 *   cd example && npm run langgraph
 */
import "dotenv/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import { Harness, type HarnessEvent, type RunResult } from "mxpf-ai-harness";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const apiKey = process.env.MXPF_HARNESS_API_KEY?.trim();
if (!apiKey) {
  console.error("Set MXPF_HARNESS_API_KEY or use: npm run langgraph:mock");
  process.exit(1);
}

const provider =
  process.env.MXPF_HARNESS_PROVIDER === "openai" ? "openai" : "anthropic";
const modelId =
  process.env.MXPF_HARNESS_MODEL?.trim() ||
  (provider === "openai" ? "gpt-4.1" : "claude-sonnet-4-5");

const FlowState = Annotation.Root({
  goal: Annotation<string>,
  events: Annotation<HarnessEvent[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  resultText: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "",
  }),
  status: Annotation<string>({
    reducer: (_a, b) => b,
    default: () => "pending",
  }),
  monitor: Annotation<string[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
});

const harness = await Harness.create({
  cwd: root,
  model: {
    provider,
    id: modelId,
    apiKey,
    baseURL: process.env.MXPF_HARNESS_BASE_URL?.trim() || undefined,
  },
  systemPrompt: "Be brief. Use tools when helpful.",
  tools: { mcp: false },
  permissions: { mode: "bypass" },
});

const graph = new StateGraph(FlowState)
  .addNode("prepare", async (state) => ({
    monitor: [`prepare: ${state.goal}`],
  }))
  .addNode("execute", async (state) => {
    const run = await harness.send(state.goal);
    const collected: HarnessEvent[] = [];
    for await (const ev of run.stream()) {
      collected.push(ev);
      if (ev.type === "assistant.text") process.stdout.write(ev.text);
      if (ev.type === "tool.start") console.log(`\n→ ${ev.name}`);
    }
    const result: RunResult = await run.wait();
    return {
      events: collected,
      resultText: result.result ?? "",
      status: result.status,
      monitor: [`execute: events=${collected.length} status=${result.status}`],
    };
  })
  .addNode("summarize", async (state) => ({
    monitor: [
      `summarize: ${state.events.filter((e) => e.type === "tool.start").length} tools used`,
    ],
  }))
  .addEdge(START, "prepare")
  .addEdge("prepare", "execute")
  .addEdge("execute", "summarize")
  .addEdge("summarize", END)
  .compile();

const out = await graph.invoke({
  goal: "Read README.md first heading and reply with only that heading text.",
});

console.log("\n\n--- monitor ---");
for (const line of out.monitor) console.log(line);

await harness[Symbol.asyncDispose]();
