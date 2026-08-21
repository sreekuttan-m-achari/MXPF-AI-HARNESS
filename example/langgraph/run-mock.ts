/**
 * LangGraph *around* mxpf-ai-harness — orchestrate + monitor a harness run.
 *
 * Pattern: LangGraph owns product workflow state; the harness owns tools/MCP/loop.
 * Events from run.stream() are appended to graph state for monitoring / LangSmith later.
 *
 *   cd example && npm run langgraph:mock
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import {
  Harness,
  type HarnessEvent,
  type ModelClient,
  type ModelCompleteResponse,
  type RunResult,
} from "mxpf-ai-harness";

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

async function main() {
  const cwd = mkdtempSync(join(tmpdir(), "mxpf-lg-"));
  const sessionDir = mkdtempSync(join(tmpdir(), "mxpf-lg-sess-"));
  writeFileSync(join(cwd, "task.txt"), "Ship v0.1.0 with examples\n", "utf8");

  const harness = await Harness.create({
    cwd,
    sessionDir,
    model: { provider: "openai", id: "mock", apiKey: "unused" },
    tools: { mcp: false },
    fetch: async () => {
      throw new Error("network disabled");
    },
  });
  (harness as unknown as { model: ModelClient }).model = mockModel([
    {
      content: [
        { type: "tool_use", id: "1", name: "Read", input: { path: "task.txt" } },
      ],
      stopReason: "tool_use",
      usage: { inputTokens: 1, outputTokens: 1 },
    },
    {
      content: [{ type: "text", text: "Task file: Ship v0.1.0 with examples" }],
      stopReason: "end_turn",
      rawText: "Task file: Ship v0.1.0 with examples",
      usage: { inputTokens: 2, outputTokens: 4 },
    },
  ]);

  const graph = new StateGraph(FlowState)
    .addNode("prepare", async (state) => ({
      monitor: [`prepare: goal=${state.goal}`],
      status: "prepared",
    }))
    .addNode("execute", async (state) => {
      const run = await harness.send(state.goal);
      const collected: HarnessEvent[] = [];
      for await (const ev of run.stream()) {
        collected.push(ev);
      }
      const result: RunResult = await run.wait();
      return {
        events: collected,
        resultText: result.result ?? "",
        status: result.status,
        monitor: [
          `execute: ${collected.length} events, status=${result.status}`,
        ],
      };
    })
    .addNode("summarize", async (state) => {
      const tools = state.events.filter((e) => e.type === "tool.start").length;
      const texts = state.events
        .filter((e) => e.type === "assistant.text")
        .map((e) => (e.type === "assistant.text" ? e.text : ""))
        .join("");
      return {
        monitor: [
          `summarize: tools=${tools}, answer=${texts.slice(0, 80)}`,
        ],
        status: state.status === "finished" ? "ok" : "failed",
      };
    })
    .addEdge(START, "prepare")
    .addEdge("prepare", "execute")
    .addEdge("execute", "summarize")
    .addEdge("summarize", END)
    .compile();

  const out = await graph.invoke({
    goal: "Read task.txt and restate the task in one sentence.",
  });

  console.log("--- LangGraph monitor log ---");
  for (const line of out.monitor) console.log(line);
  console.log("--- harness result ---");
  console.log(out.resultText);
  console.log("final status:", out.status);

  await harness[Symbol.asyncDispose]();
  rmSync(cwd, { recursive: true, force: true });
  rmSync(sessionDir, { recursive: true, force: true });
}

await main();
