# Token & Throughput Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement inline task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship balanced v0.2 harness opts: tool-result caps, extractive compaction, parallel tools, prompt-cache headers, configurable maxOutputTokens.

**Architecture:** New `src/context/` helpers; wire through `HarnessOptions` → `runAgentLoop` → model clients. Session stays lossless unless `persistCompaction`.

**Tech Stack:** TypeScript, Node ≥22, existing vitest/node test runner.

**Spec:** `docs/superpowers/specs/2026-08-21-mxpf-harness-optimizations-design.md`

## Global Constraints

- No new runtime dependencies
- Unit tests: no network
- Public API additive only (`context`, `throughput`, `ModelRef.maxOutputTokens`)
- Defaults per spec (caps on, parallel on, cache on, compaction off until budget set)

---

### Task 1: Truncate helper + types

**Files:**
- Create: `src/context/truncate.ts`
- Create: `src/context/defaults.ts`
- Modify: `src/types.ts` — add `ContextOptions`, `ThroughputOptions`, extend `HarnessOptions` / `ModelRef`
- Modify: `src/index.ts` — export new types
- Test: `tests/context-truncate.test.ts`

- [ ] Write tests for head+tail truncation and under-budget passthrough
- [ ] Implement `truncateToolResult(text, maxChars)` keeping head and last 2KB
- [ ] Add defaults constants and option types
- [ ] Commit: `feat(sdk): add tool-result truncation helper and context options types`

### Task 2: Compaction module

**Files:**
- Create: `src/context/compact.ts`
- Test: `tests/context-compact.test.ts`

- [ ] Tests: under budget unchanged; over budget inserts summary + keeps recent rounds
- [ ] Implement `estimateChars`, `compactMessages`
- [ ] Commit: `feat(sdk): add extractive context compaction`

### Task 3: Wire loop — truncate, compact, parallel tools

**Files:**
- Modify: `src/loop.ts`
- Modify: `src/run.ts` / `src/harness.ts` — pass resolved context/throughput into loop
- Modify: `src/tools/builtins.ts` — Read/Bash caps
- Modify: `src/session/store.ts` — compact JSON (no pretty-print)
- Test: `tests/harness-loop.test.ts` (extend)

- [ ] Parallel `Promise.all` preserving tool order
- [ ] Truncate before append/events
- [ ] Compact view for `complete`; optional `persistCompaction`
- [ ] Commit: `feat(sdk): parallel tools, result caps, and compaction in agent loop`

### Task 4: Model client cache + maxOutputTokens

**Files:**
- Modify: `src/model/types.ts` — pass `promptCache`, `maxOutputTokens` into complete opts if needed
- Modify: `src/model/anthropic.ts`
- Modify: `src/model/openai.ts`
- Modify: `src/model/index.ts`
- Test: `tests/model-clients.test.ts`

- [ ] Anthropic `cache_control` when promptCache
- [ ] maxOutputTokens on both clients
- [ ] Commit: `feat(sdk): prompt cache hints and configurable maxOutputTokens`

### Task 5: Docs + version

**Files:**
- Modify: `README.md`, `CHANGELOG.md`
- Create: `docs/releases/2026-08-21-v0.2.0.md` (or date of ship)
- Bump `package.json` to `0.2.0` when ready to publish

- [ ] Document knobs
- [ ] Commit: `docs(sdk): document v0.2 context and throughput options`
