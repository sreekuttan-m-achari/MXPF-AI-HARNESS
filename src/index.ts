export { Harness } from "./harness.js";
export type { HarnessEvent } from "./events.js";
export { PermissionGate } from "./permissions/gate.js";
export { SessionStore } from "./session/store.js";
export { createModelClient } from "./model/index.js";
export type {
  ModelClient,
  ModelCompleteRequest,
  ModelCompleteResponse,
  InternalMessage,
  ContentBlock,
  ToolDefinition,
} from "./model/types.js";
export { McpHost } from "./mcp/host.js";
export { ToolRouter } from "./tools/router.js";
export { DEFAULT_BUILTIN_NAMES } from "./tools/builtins.js";
export { supportsCapability, V1_CAPABILITIES } from "./types.js";
export type {
  Capability,
  ModelRef,
  ModelProvider,
  HarnessOptions,
  SendOptions,
  PermissionPolicy,
  PermissionMode,
  ToolPolicy,
  ContextOptions,
  ThroughputOptions,
  McpServerConfig,
  McpStdioServerConfig,
  McpHttpServerConfig,
  RunResult,
  RunStatus,
  TokenUsage,
} from "./types.js";
export {
  truncateToolResult,
} from "./context/truncate.js";
export {
  compactMessages,
  estimateChars,
} from "./context/compact.js";
export {
  resolveContextOptions,
  resolveThroughputOptions,
} from "./context/resolve.js";
export {
  HarnessError,
  AuthError,
  ModelError,
  CancelledError,
} from "./types.js";

/** Run surface returned by Harness.send */
export type { RunImpl as Run } from "./run.js";
