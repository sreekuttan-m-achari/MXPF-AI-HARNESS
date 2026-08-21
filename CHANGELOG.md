# Changelog

All notable changes to this project are documented in this file.

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
