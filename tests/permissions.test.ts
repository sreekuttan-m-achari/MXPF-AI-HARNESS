import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PermissionGate } from "../src/permissions/gate.js";

describe("PermissionGate", () => {
  it("bypass allows everything except deny list", () => {
    const gate = new PermissionGate({ mode: "bypass", deny: ["Bash"] });
    assert.equal(gate.check("Read").allowed, true);
    assert.equal(gate.check("Bash").allowed, false);
  });

  it("allowlist only permits matches and globs", () => {
    const gate = new PermissionGate({
      mode: "allowlist",
      allow: ["Read", "mcp__fleet__*"],
    });
    assert.equal(gate.check("Read").allowed, true);
    assert.equal(gate.check("mcp__fleet__status").allowed, true);
    assert.equal(gate.check("Write").allowed, false);
  });

  it("deny-by-default requires allow", () => {
    const gate = new PermissionGate({
      mode: "deny-by-default",
      allow: ["Glob"],
    });
    assert.equal(gate.check("Glob").allowed, true);
    assert.equal(gate.check("Read").allowed, false);
  });
});
