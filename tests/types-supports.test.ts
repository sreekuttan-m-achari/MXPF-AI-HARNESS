import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { supportsCapability, V1_CAPABILITIES } from "../src/types.js";

describe("supportsCapability", () => {
  it("enables v1 parity capabilities", () => {
    assert.equal(supportsCapability("tools"), true);
    assert.equal(supportsCapability("mcp"), true);
    assert.equal(supportsCapability("resume"), true);
    assert.equal(supportsCapability("cancel"), true);
    assert.equal(supportsCapability("structuredOutput"), true);
  });

  it("keeps roadmap capabilities false", () => {
    assert.equal(supportsCapability("subagents"), false);
    assert.equal(supportsCapability("hooks"), false);
    assert.equal(supportsCapability("observability"), false);
    assert.equal(V1_CAPABILITIES.subagents, false);
  });
});
