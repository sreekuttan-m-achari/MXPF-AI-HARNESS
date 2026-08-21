import { randomUUID } from "node:crypto";

import type { HarnessEvent } from "./events.js";
import { runAgentLoop } from "./loop.js";
import type { ModelClient } from "./model/types.js";
import { PermissionGate } from "./permissions/gate.js";
import type { SessionStore } from "./session/store.js";
import type { ToolRouter } from "./tools/router.js";
import {
  CancelledError,
  type ModelProvider,
  type RunResult,
  type RunStatus,
  type SendOptions,
} from "./types.js";

type RunDeps = {
  model: ModelClient;
  router: ToolRouter;
  permissions: PermissionGate;
  session: SessionStore;
  systemPrompt?: string;
  maxTurns: number;
  prompt: string;
  sendOpts?: SendOptions;
};

export class RunImpl {
  readonly id: string;
  status: RunStatus = "running";
  private readonly controller = new AbortController();
  private readonly listeners = new Set<(e: HarnessEvent) => void>();
  private readonly buffer: HarnessEvent[] = [];
  private readonly done: Promise<RunResult>;
  private resolveWait!: (r: RunResult) => void;

  constructor(deps: RunDeps) {
    this.id = randomUUID();
    this.done = new Promise<RunResult>((resolve) => {
      this.resolveWait = resolve;
    });
    void this.execute(deps);
  }

  stream(): AsyncIterable<HarnessEvent> {
    const self = this;
    return {
      async *[Symbol.asyncIterator]() {
        let idx = 0;
        while (true) {
          while (idx < self.buffer.length) {
            yield self.buffer[idx++]!;
          }
          if (self.status !== "running") return;
          await new Promise<void>((r) => {
            const on = () => {
              self.listeners.delete(on);
              r();
            };
            self.listeners.add(on);
          });
        }
      },
    };
  }

  wait(): Promise<RunResult> {
    return this.done;
  }

  async cancel(): Promise<void> {
    if (this.status === "running") {
      this.controller.abort();
    }
  }

  private emit(event: HarnessEvent): void {
    this.buffer.push(event);
    for (const l of this.listeners) l(event);
  }

  private async execute(deps: RunDeps): Promise<void> {
    const started = Date.now();
    try {
      deps.session.append({ role: "user", content: deps.prompt });
      this.emit({ type: "status", status: "running" });

      const result = await runAgentLoop({
        model: deps.model,
        router: deps.router,
        permissions: deps.permissions,
        session: deps.session,
        systemPrompt: deps.systemPrompt,
        maxTurns: deps.maxTurns,
        structuredOutput: deps.sendOpts?.structuredOutput,
        signal: this.controller.signal,
        emit: (e) => this.emit(e),
      });

      this.status = "finished";
      const runResult: RunResult = {
        id: this.id,
        status: "finished",
        result: result.text,
        structured: result.structured,
        model: {
          id: deps.model.modelId,
          provider: deps.model.provider as ModelProvider,
        },
        usage: result.usage,
        durationMs: Date.now() - started,
      };
      this.emit({ type: "status", status: "finished" });
      this.resolveWait(runResult);
      this.wake();
    } catch (e) {
      const cancelled =
        e instanceof CancelledError || this.controller.signal.aborted;
      this.status = cancelled ? "cancelled" : "error";
      const name = e instanceof Error ? e.name : "Error";
      const message = e instanceof Error ? e.message : String(e);
      this.emit({ type: "error", name, message });
      this.emit({ type: "status", status: this.status });
      this.resolveWait({
        id: this.id,
        status: this.status,
        error: { name, message },
        model: {
          id: deps.model.modelId,
          provider: deps.model.provider as ModelProvider,
        },
        durationMs: Date.now() - started,
      });
      this.wake();
    }
  }

  private wake(): void {
    for (const l of this.listeners) l({ type: "status", status: this.status });
  }
}
