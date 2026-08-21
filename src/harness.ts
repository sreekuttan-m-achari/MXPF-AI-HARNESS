import { homedir } from "node:os";
import { join } from "node:path";

import { McpHost } from "./mcp/host.js";
import { createModelClient } from "./model/index.js";
import type { ModelClient } from "./model/types.js";
import { PermissionGate } from "./permissions/gate.js";
import { SessionStore } from "./session/store.js";
import { DEFAULT_BUILTIN_NAMES } from "./tools/builtins.js";
import { ToolRouter } from "./tools/router.js";
import { RunImpl } from "./run.js";
import {
  supportsCapability,
  type Capability,
  type HarnessOptions,
  type SendOptions,
} from "./types.js";

function defaultSessionDir(): string {
  return join(homedir(), ".mxpf-ai-harness", "sessions");
}

function resolveApiKey(opts: HarnessOptions): HarnessOptions {
  if (opts.model.apiKey?.trim()) return opts;
  const fromEnv = process.env.MXPF_HARNESS_API_KEY?.trim();
  if (fromEnv) {
    return {
      ...opts,
      model: { ...opts.model, apiKey: fromEnv },
    };
  }
  return opts;
}

export class Harness {
  readonly sessionId: string;
  private readonly opts: HarnessOptions;
  private readonly session: SessionStore;
  private readonly model: ModelClient;
  private readonly permissions: PermissionGate;
  private router: ToolRouter;
  private mcp: McpHost | undefined;
  private activeRun: RunImpl | undefined;

  private constructor(init: {
    opts: HarnessOptions;
    session: SessionStore;
    model: ModelClient;
    permissions: PermissionGate;
    router: ToolRouter;
    mcp?: McpHost;
  }) {
    this.opts = init.opts;
    this.session = init.session;
    this.sessionId = init.session.sessionId;
    this.model = init.model;
    this.permissions = init.permissions;
    this.router = init.router;
    this.mcp = init.mcp;
  }

  static async create(options: HarnessOptions): Promise<Harness> {
    const opts = resolveApiKey(options);
    const sessionDir = opts.sessionDir ?? defaultSessionDir();
    const session = SessionStore.create(sessionDir);
    return Harness.build(opts, session);
  }

  static async resume(
    sessionId: string,
    options: HarnessOptions,
  ): Promise<Harness> {
    const opts = resolveApiKey(options);
    const sessionDir = opts.sessionDir ?? defaultSessionDir();
    const session = SessionStore.resume(sessionDir, sessionId);
    return Harness.build(opts, session);
  }

  private static async build(
    opts: HarnessOptions,
    session: SessionStore,
  ): Promise<Harness> {
    const model = createModelClient({
      model: opts.model,
      fetchFn: opts.fetch,
    });
    const permissions = new PermissionGate(opts.permissions ?? {});

    let mcp: McpHost | undefined;
    const useMcp = opts.tools?.mcp !== false && opts.mcpServers;
    if (useMcp && opts.mcpServers && Object.keys(opts.mcpServers).length > 0) {
      mcp = await McpHost.connect(opts.mcpServers, { cwd: opts.cwd });
    }

    const router = new ToolRouter({
      cwd: opts.cwd,
      builtinNames: opts.tools?.builtins ?? [...DEFAULT_BUILTIN_NAMES],
      mcp,
    });

    return new Harness({ opts, session, model, permissions, router, mcp });
  }

  supports(c: Capability): boolean {
    return supportsCapability(c);
  }

  async send(prompt: string, sendOpts?: SendOptions): Promise<RunImpl> {
    if (this.activeRun && this.activeRun.status === "running") {
      throw new Error("A run is already in progress");
    }
    const run = new RunImpl({
      model: this.model,
      router: this.router,
      permissions: this.permissions,
      session: this.session,
      systemPrompt: this.opts.systemPrompt,
      maxTurns: this.opts.maxTurns ?? 40,
      prompt,
      sendOpts,
    });
    this.activeRun = run;
    return run;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this.activeRun && this.activeRun.status === "running") {
      await this.activeRun.cancel();
    }
    if (this.mcp) {
      await this.mcp.close();
    }
  }
}
