# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

## [0.2.0] — 2026-08-21

### Added

- **Context budgets:** `HarnessOptions.context` with tool-result / Read / Bash caps, optional `autoCompact` / `maxInputChars` extractive compaction (model view; session stays lossless unless `persistCompaction`).
- **Throughput:** `HarnessOptions.throughput.parallelTools` (default on) runs tool_uses in one step concurrently; `promptCache` enables Anthropic `cache_control` on system + last tool.
- **`ModelRef.maxOutputTokens`** — forwarded to Anthropic `max_tokens` and OpenAI `max_tokens`.
- Compact session JSON persistence (no pretty-print).

### Notes

- Compaction is **off** until `context.autoCompact` or `context.maxInputChars` is set.
- Design: `docs/superpowers/specs/2026-08-21-mxpf-harness-optimizations-design.md`.

## [0.1.1] — 2026-08-21

### Added

- `example/` demos: basic harness + LangGraph orchestrate/monitor pattern.
- Public export of `ModelClient` / `ModelCompleteResponse` types for tests and examples.
- Optional LangSmith wiring in examples (env-ready).
- GitHub Actions CI + release publish via npm Trusted Publishing (OIDC); `docs/publishing.md`.

### Fixed

- Publish workflow no longer requires `NPM_TOKEN` when Trusted Publisher is configured.
- Release version gate: `package.json` must match the GitHub release tag (e.g. `v0.1.1` ↔ `0.1.1`).

## [0.1.0] — 2026-08-21

### Added

- First public release of **`mxpf-ai-harness`**: MaximProf-native agent harness SDK.
- `Harness.create` / `Harness.resume` / `send` → `Run` with `stream()`, `wait()`, `cancel()`.
- Agent loop with built-in tools: `Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep` (cwd-sandboxed).
- MCP host for **stdio** servers (Cursor-compatible config shape); tools named `mcp__{server}__{tool}`.
- Permission modes: `bypass`, `allowlist`, `deny-by-default` (+ allow/deny patterns).
- Dual model pipes: Anthropic Messages API and OpenAI-compatible Chat Completions (tool calling), with optional `baseURL` for OpenRouter / LiteLLM / local gateways.
- Durable session store under `sessionDir` (default `~/.mxpf-ai-harness/sessions`).
- `supports(capability)` matrix: tools/mcp/resume/cancel/structuredOutput enabled; subagents/hooks/observability reserved for roadmap.
- Unit tests with mocked providers (no live API keys required in CI).
- README, design spec, and release notes.

### Notes for consumers

- AARIA / VIVA / Code-Reviewer adapters are **out of this package**; consume via npm and map to product agent interfaces.
- HTTP MCP transports are not wired in 0.1.0 (stdio only).
- Publish target: public npm account `sreekuttan.m.achari` (not maximprof private scope).
