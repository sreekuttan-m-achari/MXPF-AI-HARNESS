# mxpf-ai-harness examples

Small demos for the SDK living in this repo (not published to npm).

```bash
cd example
npm install
cp .env.sample .env   # set MXPF_HARNESS_API_KEY for live runs
```

## Examples

| Script | What it shows |
|--------|----------------|
| `npm run basic:mock` | Harness loop with a **mock** model (no API key) — tools + stream events |
| `npm run basic` | Live desk-style turn (needs API key) |
| `npm run langgraph:mock` | **LangGraph** workflow that *orchestrates/monitors* a harness run |
| `npm run langgraph` | Same with a live model |

## LangChain / LangGraph — is it possible?

**Yes.** Recommended split:

| Layer | Role |
|-------|------|
| **`mxpf-ai-harness`** | Agent loop, tools, MCP, permissions, sessions, model pipes |
| **LangGraph (optional)** | Multi-step *product* flows: plan → run harness → verify → retry; checkpointing; human-in-the-loop gates; monitoring |

Do **not** replace the harness ReAct/tool loop with LangGraph’s own tool agent for coding — that duplicates what the SDK already owns. Use LangGraph *around* `Harness.send`, and feed `run.stream()` events into graph state / LangSmith for observability.

See `langgraph/run-mock.ts` for a minimal pattern: graph nodes `prepare` → `execute` → `summarize`, with harness events collected into state for monitoring.
