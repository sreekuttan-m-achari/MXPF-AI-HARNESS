# LangGraph + mxpf-ai-harness

Yes — use **LangGraph to manage/monitor flows**, keep **mxpf-ai-harness as the agent loop**.

```text
┌─────────────────────────────────────┐
│ LangGraph (product orchestration)   │
│  prepare → execute → verify → …     │
│  checkpoints, HITL, retries         │
└──────────────┬──────────────────────┘
               │ Harness.send(goal)
               ▼
┌─────────────────────────────────────┐
│ mxpf-ai-harness                     │
│  model ↔ tools/MCP ↔ permissions    │
│  stream events for monitoring       │
└─────────────────────────────────────┘
```

## Why not LangGraph-only?

LangGraph is excellent for **graph control flow**. The harness owns **coding-agent quality**: cwd tools, MCP, permission modes, dual model pipes, session resume — the same parity bar vs Cursor/Claude SDKs.

## Monitoring

- Collect `run.stream()` events into graph state (see `run-mock.ts`)
- Optionally forward the same events to LangSmith / OpenTelemetry later (roadmap `observability` capability)

## Roadmap (optional package)

A future `@…/mxpf-ai-harness-langgraph` helper could wrap `Harness` as a reusable LangGraph node + trajectory exporter. Not required for v0.1.0 — the example pattern is enough to start.
