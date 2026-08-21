# mxpf-ai-harness examples

Small demos that install the **published** package from npm (`mxpf-ai-harness@^0.1.1`).

```bash
cd example
npm install
cp .env.sample .env   # or use the prepared .env — fill API keys
```

For local unpublished SDK work, temporarily use `"mxpf-ai-harness": "file:.."` instead.

**Env keys**

| Variable | Required for | Purpose |
|----------|--------------|---------|
| `MXPF_HARNESS_API_KEY` | `basic` / `langgraph` | OpenRouter or provider API key |
| `MXPF_HARNESS_PROVIDER` | optional | `openai` for OpenRouter (default in sample); or `anthropic` |
| `MXPF_HARNESS_MODEL` | optional | Default sample: [`openrouter/free`](https://openrouter.ai/openrouter/free) |
| `MXPF_HARNESS_BASE_URL` | OpenRouter | Must be `https://openrouter.ai/api/v1` (include `/v1`) |
| `LANGSMITH_API_KEY` | optional | [LangSmith](https://smith.langchain.com/o/b7827736-fb11-449f-aca5-8aa59d6a7035) traces |
| `LANGSMITH_PROJECT` | optional | Default `mxpf-ai-harness-examples` |

**OpenRouter free setup**

1. Create a key at https://openrouter.ai/keys  
2. Put it in `MXPF_HARNESS_API_KEY` in `.env`  
3. Keep `PROVIDER=openai`, `MODEL=openrouter/free`, `BASE_URL=https://openrouter.ai/api/v1`  
4. `npm run basic` or `npm run langgraph`

`openrouter/free` routes among free models and prefers ones that support tools when the harness sends tool schemas.

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
