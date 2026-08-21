# MXPF AI Harness v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `mxpf-ai-harness@0.1.0` TypeScript SDK (agent loop, tools, MCP, permissions, dual model pipes, sessions) with README and release notes, ready for npm publish and AARIA adapter follow-up.

**Architecture:** Greenfield ESM package. `Harness.create/resume` → `send` → `Run` with stream/wait/cancel. Internal loop calls injectable `ModelClient` (anthropic | openai), `PermissionGate`, `ToolRouter` (builtins + MCP). Products inject `systemPrompt` / `mcpServers`; SDK does not own persona/MEMORY.

**Tech Stack:** TypeScript 5.7+, Node ≥22, ESM, zod, `@modelcontextprotocol/sdk`, node:test, tsc build to `dist/`.

## Global Constraints

- Package name: `mxpf-ai-harness` (unscoped, public npm under `sreekuttan.m.achari`)
- Node engines: `>=22`
- Module: ESM (`"type": "module"`)
- No dependency on `@cursor/sdk` or `@anthropic-ai/claude-agent-sdk`
- v1 `supports()`: tools, mcp, resume, cancel, structuredOutput = true; subagents, hooks, observability = false
- Permission modes: `bypass` | `allowlist` | `deny-by-default`; default `bypass`
- Dual pipes: Anthropic Messages API + OpenAI Chat Completions tool-calling
- Docs required: `README.md`, `CHANGELOG.md` / release notes for 0.1.0
- AARIA adapter is out of this repo’s v0.1.0 code (documented as next consumer step)

## File map

| Path | Responsibility |
|------|----------------|
| `package.json` | Package metadata, exports, scripts |
| `tsconfig.json` | Strict ESM compile to `dist/` |
| `src/types.ts` | Public types: Capability, ModelRef, HarnessOptions, RunResult, errors |
| `src/events.ts` | HarnessEvent union |
| `src/permissions/gate.ts` | PermissionGate |
| `src/session/store.ts` | Durable session JSON store |
| `src/model/types.ts` | ModelClient interface + message types |
| `src/model/anthropic.ts` | Anthropic Messages client |
| `src/model/openai.ts` | OpenAI-compatible Chat Completions client |
| `src/model/index.ts` | createModelClient factory |
| `src/tools/builtins.ts` | Read/Write/Edit/Bash/Glob/Grep |
| `src/tools/router.ts` | ToolRouter |
| `src/mcp/host.ts` | MCP stdio host + tool listing/calling |
| `src/loop.ts` | Agent loop |
| `src/run.ts` | Run implementation |
| `src/harness.ts` | Harness class |
| `src/index.ts` | Public exports |
| `tests/*.test.ts` | Unit + mocked provider tests |
| `README.md` | Install, API, config, consumer notes |
| `CHANGELOG.md` | 0.1.0 release notes |
| `docs/releases/2026-08-21-v0.1.0.md` | Detailed release notes |

---

### Task 1: Package scaffold + public types

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/types.ts`, `src/events.ts`, `src/index.ts` (stub)
- Test: `tests/types-supports.test.ts`

**Interfaces:**
- Produces: `Capability`, `ModelRef`, `HarnessOptions`, `PermissionPolicy`, `SendOptions`, `RunResult`, `HarnessEvent`, error classes

- [x] Scaffold package and types (implemented inline with this plan execution)
- [x] `supports()` helper reflecting v1 capability matrix
- [x] Commit scaffold

### Task 2: Permissions + session store

**Files:**
- Create: `src/permissions/gate.ts`, `src/session/store.ts`
- Test: `tests/permissions.test.ts`, `tests/session.test.ts`

- [x] PermissionGate modes + allow/deny lists
- [x] Session create/resume/persist messages

### Task 3: Built-in tools + router

**Files:**
- Create: `src/tools/builtins.ts`, `src/tools/router.ts`
- Test: `tests/tools.test.ts`

- [x] Read/Write/Edit/Bash/Glob/Grep under cwd sandbox
- [x] Router dispatches builtins; MCP prefix deferred to Task 4

### Task 4: Model clients (mockable)

**Files:**
- Create: `src/model/*`
- Test: `tests/model-anthropic.test.ts`, `tests/model-openai.test.ts`

- [x] Anthropic + OpenAI clients via injectable `fetch`
- [x] Normalize tool calls into internal format

### Task 5: MCP host

**Files:**
- Create: `src/mcp/host.ts`, `src/mcp/types.ts`
- Test: `tests/mcp-config.test.ts` (config shape; live stdio optional)

- [x] Accept Cursor-like `McpServerConfig` map
- [x] List/call tools; integrate into ToolRouter

### Task 6: Loop + Run + Harness

**Files:**
- Create: `src/loop.ts`, `src/run.ts`, `src/harness.ts`
- Modify: `src/index.ts`
- Test: `tests/harness-loop.test.ts` (mock ModelClient)

- [x] Full turn loop with cancel via AbortSignal
- [x] Harness.create / resume / send / dispose
- [x] structuredOutput option on send

### Task 7: Docs + release notes + version 0.1.0

**Files:**
- Create: `README.md`, `CHANGELOG.md`, `docs/releases/2026-08-21-v0.1.0.md`
- Modify: `package.json` version `0.1.0`

- [x] README: install, quickstart, API, permissions, model pipes, AARIA wiring sketch
- [x] Release notes for 0.1.0
- [x] Run tests + build
- [x] Commit and push when authorized

## Spec coverage check

| Spec section | Task |
|--------------|------|
| Full agent loop | 6 |
| MaximProf-native API | 1, 6 |
| Dual model pipes | 4 |
| Tools + MCP | 3, 5 |
| Permissions | 2 |
| Session resume | 2, 6 |
| supports() | 1 |
| README + release | 7 |
| AARIA adapter | Documented next step (not in package code) |
| Roadmap B | supports() returns false |

## Execution note

User requested immediate implementation after spec approval. This plan is executed inline in the same session (scaffold → core → loop → docs → tests).
