import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import type { InternalMessage } from "../model/types.js";

export type SessionData = {
  sessionId: string;
  messages: InternalMessage[];
  createdAt: string;
  updatedAt: string;
};

export class SessionStore {
  readonly sessionDir: string;
  readonly sessionId: string;
  private messages: InternalMessage[];

  private constructor(
    sessionDir: string,
    sessionId: string,
    messages: InternalMessage[],
  ) {
    this.sessionDir = sessionDir;
    this.sessionId = sessionId;
    this.messages = messages;
  }

  static create(sessionDir: string, sessionId?: string): SessionStore {
    mkdirSync(sessionDir, { recursive: true });
    const id = sessionId ?? randomUUID();
    const store = new SessionStore(sessionDir, id, []);
    store.persist();
    return store;
  }

  static resume(sessionDir: string, sessionId: string): SessionStore {
    const path = SessionStore.pathFor(sessionDir, sessionId);
    if (!existsSync(path)) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const raw = JSON.parse(readFileSync(path, "utf8")) as SessionData;
    return new SessionStore(sessionDir, raw.sessionId, raw.messages ?? []);
  }

  static pathFor(sessionDir: string, sessionId: string): string {
    return join(sessionDir, `${sessionId}.json`);
  }

  getMessages(): InternalMessage[] {
    return [...this.messages];
  }

  setMessages(messages: InternalMessage[]): void {
    this.messages = [...messages];
    this.persist();
  }

  append(message: InternalMessage): void {
    this.messages.push(message);
    this.persist();
  }

  private persist(): void {
    mkdirSync(this.sessionDir, { recursive: true });
    const now = new Date().toISOString();
    const data: SessionData = {
      sessionId: this.sessionId,
      messages: this.messages,
      createdAt: now,
      updatedAt: now,
    };
    // Preserve createdAt if file exists
    const path = SessionStore.pathFor(this.sessionDir, this.sessionId);
    if (existsSync(path)) {
      try {
        const prev = JSON.parse(readFileSync(path, "utf8")) as SessionData;
        data.createdAt = prev.createdAt ?? now;
      } catch {
        // ignore corrupt prior
      }
    }
    writeFileSync(path, JSON.stringify(data), "utf8");
  }
}
