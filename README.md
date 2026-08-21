# mxpf-ai-harness

MaximProf **AI agent harness** SDK — the scaffolding around the model (agent loop, tools, MCP, permissions, sessions, dual model pipes).

Publishable npm package for AARIA, VIVA (AI Developer), Code-Reviewer, and other consumers. Cursor SDK and Claude Agent SDK remain switchable backends in those products; this package is the first-party harness option (`runtime = mxpf`).

Inspired by [awesome-harness-engineering](https://github.com/ai-boost/awesome-harness-engineering): optimize the harness, not only the model.

## Install

```bash
npm install mxpf-ai-harness
```

Requires **Node.js ≥ 22**.

Public package under the [`sreekuttan.m.achari`](https://www.npmjs.com/settings/sreekuttan.m.achari/packages) npm account. Repo: [sreekuttan-m-achari/MXPF-AI-HARNESS](https://github.com/sreekuttan-m-achari/MXPF-AI-HARNESS).

## Quick start

```ts
import { Harness } from "mxpf-ai-harness";

const harness = await Harness.create({
  cwd: process.cwd(),
  model: {
    provider: "anthropic", // or "openai"
    id: "claude-sonnet-4-5",
    apiKey: process.env.MXPF_HARNESS_API_KEY,
    // baseURL: "https://openrouter.ai/api", // optional pipe
  },
  systemPrompt: "You are a careful coding agent.",
  permissions: { mode: "bypass" }, // or allowlist | deny-by-default
});

const run = await harness.send("Summarize the README in one sentence.");
for await (const event of run.stream()) {
  if (event.type === "assistant.text") process.stdout.write(event.text);
}
const result = await run.wait();
console.log("\n", result.status, result.usage);

await harness[Symbol.asyncDispose]();
```

Resume a prior session:

```ts
const harness = await Harness.resume(sessionId, { /* same options */ });
```

## Capabilities (`supports`)

| Capability | v0.1.0 |
|------------|--------|
| `tools` | yes |
| `mcp` | yes (stdio servers) |
| `resume` | yes |
| `cancel` | yes |
| `structuredOutput` | yes |
| `subagents` / `hooks` / `observability` | roadmap |

```ts
harness.supports("tools"); // true
harness.supports("subagents"); // false until roadmap B
```

## Built-in tools

`Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep` — paths sandboxed under `cwd`.

## MCP

Pass Cursor-style server configs (stdio in v0.1.0; HTTP skipped with a warning):

```ts
await Harness.create({
  cwd,
  model,
  mcpServers: {
    memory: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    },
  },
});
```

Tools appear as `mcp__{server}__{tool}`.

## Permissions

```ts
permissions: {
  mode: "bypass" | "allowlist" | "deny-by-default",
  allow: ["Read", "mcp__fleet__*"],
  deny: ["Bash"],
}
```

Default mode is `bypass` (desk agents). Denied tools return an error tool result into the loop (no TTY prompts).

## Model pipes

| Provider | API | Typical pipes |
|----------|-----|----------------|
| `anthropic` | Messages (`/v1/messages`) | Anthropic, OpenRouter Anthropic skin, LiteLLM |
| `openai` | Chat Completions + tools | OpenAI, OpenRouter, Ollama OpenAI API |

Set `model.baseURL` + `model.apiKey`, or `MXPF_HARNESS_API_KEY`.

## Events

`assistant.text` · `tool.start` · `tool.result` · `status` · `error` · `usage`

## Product wiring (AARIA sketch)

```bash
AARIA_RUNTIME=mxpf
AARIA_MODEL=claude-sonnet-4-5
MXPF_HARNESS_API_KEY=...
MXPF_HARNESS_BASE_URL=   # optional
MXPF_HARNESS_PERMISSION_MODE=bypass
```

Keep `AARIA_RUNTIME=cursor` (default) and `claude` as switchable alternatives. Adapter lives in the AARIA repo (`src/runtime/mxpf.ts`) — not inside this package.

## Examples

Small projects under [`example/`](./example):

```bash
cd example && npm install
npm run basic:mock       # offline harness demo
npm run langgraph:mock   # LangGraph orchestrates + monitors a harness run
```

Live runs: copy `example/.env.sample` → `.env`, set `MXPF_HARNESS_API_KEY`, then `npm run basic` / `npm run langgraph`.

**LangChain / LangGraph:** yes — use LangGraph *around* the harness for multi-step flows and monitoring; keep tool/MCP loops inside `mxpf-ai-harness`. See [`example/langgraph/README.md`](./example/langgraph/README.md).

## Scripts

```bash
npm install
npm test
npm run build
```

## Design docs

- [Design spec](docs/superpowers/specs/2026-08-21-mxpf-ai-harness-design.md)
- [Implementation plan](docs/superpowers/plans/2026-08-21-mxpf-ai-harness.md)
- [v0.1.0 release notes](docs/releases/2026-08-21-v0.1.0.md)

## License

MIT
