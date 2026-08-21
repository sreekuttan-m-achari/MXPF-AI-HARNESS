import type { PermissionMode, PermissionPolicy } from "../types.js";

function matchPattern(name: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }
  return name === pattern;
}

function matchesAny(name: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => matchPattern(name, p));
}

export type PermissionDecision = { allowed: boolean; reason: string };

export class PermissionGate {
  readonly mode: PermissionMode;
  readonly allow: string[];
  readonly deny: string[];

  constructor(policy: PermissionPolicy = {}) {
    this.mode = policy.mode ?? "bypass";
    this.allow = policy.allow ?? [];
    this.deny = policy.deny ?? [];
  }

  check(toolName: string): PermissionDecision {
    if (matchesAny(toolName, this.deny)) {
      return { allowed: false, reason: `denied by deny list: ${toolName}` };
    }

    if (this.mode === "bypass") {
      return { allowed: true, reason: "bypass" };
    }

    if (this.mode === "allowlist") {
      if (matchesAny(toolName, this.allow)) {
        return { allowed: true, reason: "allowlist match" };
      }
      return { allowed: false, reason: `not on allowlist: ${toolName}` };
    }

    // deny-by-default: allow list required
    if (matchesAny(toolName, this.allow)) {
      return { allowed: true, reason: "allowlist match" };
    }
    return {
      allowed: false,
      reason: `deny-by-default: ${toolName}`,
    };
  }
}
