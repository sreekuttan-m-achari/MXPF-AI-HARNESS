# mxpf-ai-harness examples

Small demos for the SDK living in this repo (not published to npm).

```bash
cd example
npm install
cp .env.sample .env   # or use the prepared .env — fill API keys
```

**Env keys**

| Variable | Required for | Purpose |
|----------|--------------|---------|
| `MXPF_HARNESS_API_KEY` | `basic` / `langgraph` | Model provider auth |
| `MXPF_HARNESS_PROVIDER` | optional | `anthropic` (default) or `openai` |
| `MXPF_HARNESS_MODEL` | optional | Model id |
| `MXPF_HARNESS_BASE_URL` | optional | OpenRouter / LiteLLM / local pipe |
| `LANGSMITH_API_KEY` | optional | [LangSmith](https://smith.langchain.com/o/b7827736-fb11-449f-aca5-8aa59d6a7035) traces |
| `LANGSMITH_PROJECT` | optional | Default `mxpf-ai-harness-examples` |

LangSmith stays off until you paste an API key; then live LangGraph runs log `[langsmith] tracing on`.

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
