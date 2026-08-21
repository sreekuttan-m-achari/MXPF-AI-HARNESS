# MXPF AI Harness (`mxpf-ai-harness`) — design

**Date:** 2026-08-21  
**Status:** Approved for implementation planning  
**Repo (planned):** https://github.com/sreekuttan-m-achari/MXPF-AI-HARNESS  
**npm (planned):** `mxpf-ai-harness` (public, account `sreekuttan.m.achari`)  
**Related:** [awesome-harness-engineering](https://github.com/ai-boost/awesome-harness-engineering); AARIA switchable runtime (`MXPF-AARIA-API`); pluggable brain future notes in AARIA/VIVA/Code-Reviewer

---

## 1. Goal

Ship a **dedicated, first-party agent harness SDK** — the scaffolding around the model (agent loop, tools, MCP, permissions, sessions, streaming, dual model pipes) — published as a public npm package and consumed by MaximProf products without dropping the quality currently obtained from `@cursor/sdk` and `@anthropic-ai/claude-agent-sdk`.

Products keep Cursor and Claude as **switchable** backends. MXPF becomes a third runtime option, then the preferred long-term path for AARIA → VIVA (AI Developer) → Code-Reviewer.

**Publishing policy:** Public packages and repos under `sreekuttan-m-achari` / `sreekuttan.m.achari`. The `maximprof` org/account remains for **private** repos and packages.

---

## 2. Decisions (locked)

| Topic | Choice |
|-------|--------|
| What “MXPF harness” means | Full first-party agent loop (not a thin façade over Claude/Cursor) |
| Public API shape | MaximProf-native (`Harness` / `Run` / events / `supports`) |
| v1 capability bar | Parity core: stream, cancel, resume, coding tools, MCP, headless permissions, dual model pipes |
| Roadmap | Subagents, hooks, observability/trajectory (orchestration tier) |
| Cross-product fit | One core API + `supports(capability)` flags |
| Naming | GitHub `MXPF-AI-HARNESS`; npm `mxpf-ai-harness`; runtime id `mxpf` |
| Model backends | Anthropic Messages + OpenAI-compatible (`baseURL` / apiKey) |
| Permissions | Modes: `bypass` \| `allowlist` \| `deny-by-default` + declarative rules; default `bypass` for desk agents |
| Implementation | Greenfield TypeScript SDK (Node ≥22, ESM) |

---

## 3. Architecture

```text
Consumers (AARIA / VIVA / Code-Reviewer)
        │  import { Harness } from "mxpf-ai-harness"
        ▼
┌─────────────────────────────────────────────┐
│  mxpf-ai-harness                            │
│  Harness.create / resume                    │
│  Harness.send → Run (stream / wait / cancel)│
│  supports(capability)                       │
├─────────────────────────────────────────────┤
│  Loop │ Tools │ MCP │ Permissions │ Session │
├───────────────┬─────────────────────────────┤
│ ModelClient   │  anthropic-messages         │
│               │  openai-compatible          │
│               │  (baseURL + apiKey)         │
└───────────────┴─────────────────────────────┘

AARIA (example):
  AARIA_RUNTIME=cursor | claude | mxpf
```

### Ownership boundary

| Layer | Owns | Does not own |
|-------|------|----------------|
| **SDK** | Agent loop, built-in tools, MCP host, permission gate, session durability, streaming events, model pipes | Persona files, MEMORY curation UX, skill pack discovery UI, MQTT fleet, TUI, product schedulers |
| **Products** | Adapter to product agent interface, system prompt / persona / skills injection, product config | Reimplementing the tool loop |

Harness engineering principle (from the awesome list): optimize the **scaffolding**, not the model. OpenRouter/Ollama/LiteLLM are **pipes** into `ModelClient`, not separate harnesses. Chat-completions-only clients that drop tools/MCP are out of scope.

---

## 4. Public API surface

```ts
type Capability =
  | "tools"
  | "mcp"
  | "resume"
  | "cancel"
  | "structuredOutput" // Code-Reviewer / JSON schema turns
  | "subagents"        // roadmap — false in v1
  | "hooks"            // roadmap — false in v1
  | "observability";   // roadmap — false in v1

type ModelRef = {
  provider: "anthropic" | "openai";
  id: string;
  baseURL?: string;
  apiKey?: string;
};

type HarnessOptions = {
  cwd: string;
  model: ModelRef;
  tools?: ToolPolicy;
  mcpServers?: McpServerConfig[];
  permissions?: PermissionPolicy;
  sessionDir?: string;
  systemPrompt?: string;
};

declare class Harness {
  static create(opts: HarnessOptions): Promise<Harness>;
  static resume(sessionId: string, opts: HarnessOptions): Promise<Harness>;
  readonly sessionId: string;
  supports(c: Capability): boolean;
  send(prompt: string, opts?: SendOptions): Promise<Run>;
  [Symbol.asyncDispose](): Promise<void>;
}

interface Run {
  readonly id: string;
  readonly status: "running" | "finished" | "error" | "cancelled";
  stream(): AsyncIterable<HarnessEvent>;
  wait(): Promise<RunResult>;
  cancel(): Promise<void>;
}
```

### Events

Stable product-facing events (names illustrative; finalize in implementation plan):

- `assistant.text`
- `tool.start` / `tool.result`
- `status`
- `error`
- `usage`

AARIA’s streaming collector adapts these for the `mxpf` path. The mxpf adapter must **not** require importing `@cursor/sdk` types.

### `supports()` in v1

| Capability | v1 |
|------------|----|
| `tools`, `mcp`, `resume`, `cancel` | `true` |
| `structuredOutput` | `true` (optional JSON schema on `send`) |
| `subagents`, `hooks`, `observability` | `false` until roadmap B |

---

## 5. Internal components & turn flow

```text
send(prompt)
  → append user turn to SessionStore
  → Loop:
       ModelClient.complete(messages, tools[])
       if tool_calls:
         PermissionGate.check(each)
         ToolRouter.execute (builtin | mcp)
         append tool results
       else:
         emit assistant text / finish
  → Run.wait() → RunResult (+ usage)
```

| Component | Responsibility |
|-----------|----------------|
| **SessionStore** | Durable `sessionId`, message history under `sessionDir` |
| **ModelClient** | Anthropic Messages ↔ OpenAI-compat normalization (incl. tool calling) |
| **ToolRouter** | Built-ins: Read, Write, Edit, Bash, Glob, Grep; MCP as `mcp__{server}__{tool}` |
| **McpHost** | Connect from product-supplied `McpServerConfig` (compatible with AARIA’s `.cursor/mcp.json` loader shape) |
| **PermissionGate** | Evaluate mode + rules before every tool execution; no interactive prompts in headless |
| **RunController** | AbortSignal, status, stream fan-out, cancel |

### Error handling

- Tool failures → structured tool results back into the loop (recoverable).
- Model/auth/cancel → fail the `Run` with typed errors (`AuthError`, `ModelError`, `CancelledError`).
- Permission deny → tool result or hard fail per policy (documented); never block on a TTY prompt.

---

## 6. Package layout

Single public package first (monorepo only if later needed):

```text
MXPF-AI-HARNESS/
  src/
    harness.ts
    loop.ts
    model/
    tools/
    mcp/
    permissions/
    session/
    events.ts
    types.ts
  tests/
  docs/superpowers/specs/
  docs/superpowers/plans/
  README.md
  package.json   # name: mxpf-ai-harness
```

Stack: TypeScript, Node `>=22`, ESM, `zod` for option/tool schemas (align with AARIA).

---

## 7. Product integration

### AARIA (first consumer)

- Extend `AgentRuntimeKind` with `"mxpf"`.
- Add `src/runtime/mxpf.ts` wrapping `Harness` as `AriaAgent` / `AriaRun`.
- Persist session id in `agent-id.mxpf.txt` (alongside cursor/claude files).
- Keep `AARIA_RUNTIME=cursor` (default) and `claude` fully switchable.
- Prefer peeling Cursor-only type imports from shared stream/usage helpers over time so the shell stays harness-neutral.

### VIVA / Code-Reviewer (same SDK, later adapters)

- Same `Harness` API.
- VIVA: tools + MCP + resume + `cwd` workspace (same as AARIA quality bar).
- Code-Reviewer: may start with stream + `structuredOutput`; enable tools/MCP when needed via options + `supports()`.

---

## 8. Configuration (consumer sketch)

```bash
# AARIA
AARIA_RUNTIME=mxpf
AARIA_MODEL=anthropic/claude-sonnet-4-5   # or openai-compatible model id
MXPF_HARNESS_BASE_URL=https://openrouter.ai/api   # optional pipe
MXPF_HARNESS_API_KEY=...
MXPF_HARNESS_PERMISSION_MODE=bypass               # or allowlist | deny-by-default
```

Exact env names may be refined in the implementation plan; SDK options remain the source of truth (env is product wiring).

---

## 9. Testing

| Layer | Scope |
|-------|--------|
| Unit | Loop stop conditions, permission gate, tool schemas, session resume, event mapping |
| Provider contract | Mock Anthropic + OpenAI-compat fixtures (tool_calls round-trip); no live keys in CI |
| Manual / optional CI | Live smoke vs OpenRouter or local Ollama when secrets present |
| Parity smoke | Scripted tasks (read/edit file, MCP echo) comparable to AARIA Claude path |

---

## 10. Publishing & rollout

1. Scaffold repo + implement v1 core → publish `mxpf-ai-harness@0.1.0`.
2. AARIA adapter (`AARIA_RUNTIME=mxpf`); Cursor + Claude remain switchable.
3. Harden with desk usage and parity smokes.
4. VIVA + Code-Reviewer adapters.
5. Roadmap B: subagents, hooks, observability (`supports()` flips true per feature).

**CI:** lint + unit tests on PR; Conventional Commits; semver.

---

## 11. Non-goals (v1)

- Plugin / skill marketplace inside the SDK
- Python SDK or dual-language core
- Automatic mid-session failover across Cursor ↔ Claude ↔ MXPF
- Embedding product persona, MEMORY approval UX, or fleet MQTT inside the package
- Chat-only clients that omit the tool/MCP loop
- maximprof-scoped public publish (private org only)

---

## 12. Success criteria

- AARIA can set `AARIA_RUNTIME=mxpf` and complete multi-turn desk tasks with tools + MCP + cancel + resume.
- Same package is usable from VIVA and Code-Reviewer without forking the loop.
- Cursor and Claude runtimes remain available and default behavior for AARIA is unchanged when `AARIA_RUNTIME` is unset.
- Public install: `npm i mxpf-ai-harness` from the `sreekuttan.m.achari` npm account.
- Roadmap B features are representable in `supports()` without breaking the v1 API.
