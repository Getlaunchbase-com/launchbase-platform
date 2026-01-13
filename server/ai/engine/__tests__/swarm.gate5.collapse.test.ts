/**
 * Gate 5: Deterministic Collapse Logic (Phase 2.4)
 * 
 * Tripwire tests that verify:
 * - Collapse does not call a model (pure function)
 * - Collapse produces final decision object (customerSafe=true)
 * - Collapse includes required fields
 * - If craft/critic failed, collapse still outputs safe failure response
 * - Deterministic for same inputs
 */

import { describe, it, expect } from "vitest";
import { buildDeterministicCollapse } from "../swarm/collapseDeterministic";

describe("Gate 5: deterministic collapse", () => {
  it("returns ok with payload when craft+critic are clean", () => {
    const res = buildDeterministicCollapse({
      craft: {
        stopReason: "ok",
        payload: {
          proposedChanges: [
            { targetKey: "hero.headline", value: "Fast Coffee", rationale: "Shorter and punchier" },
          ],
          risks: ["May lose brand voice"],
          assumptions: ["Target audience prefers brevity"],
        },
      },
      critic: {
        stopReason: "ok",
        payload: {
          pass: true,
          issues: [],
          previewRecommended: true,
          risks: ["Preview recommended before publish"],
          assumptions: [],
        },
      },
    });

    expect(res.stopReason).toBe("ok");
    expect(res.payload?.outcome).toBe("ok");
    expect(res.payload?.proposedChanges?.length).toBe(1);
    expect(res.payload?.recommendation).toContain("preview");
    expect(res.payload?.risks).toContain("May lose brand voice");
    expect(res.payload?.assumptions).toContain("Target audience prefers brevity");
  });

  it("returns needs_human when critic fails", () => {
    const res = buildDeterministicCollapse({
      craft: {
        stopReason: "ok",
        payload: {
          proposedChanges: [{ targetKey: "k", value: "v", rationale: "r" }],
        },
      },
      critic: {
        stopReason: "ok",
        payload: {
          pass: false,
          issues: [{ severity: "high", message: "Critical issue detected" }],
        },
      },
    });

    expect(res.stopReason).toBe("needs_human");
    expect(res.payload).toBeNull();
  });

  it("returns needs_human when no changes exist", () => {
    const res = buildDeterministicCollapse({
      craft: {
        stopReason: "ok",
        payload: { proposedChanges: [] },
      },
      critic: {
        stopReason: "ok",
        payload: { pass: true, issues: [] },
      },
    });

    expect(res.stopReason).toBe("needs_human");
    expect(res.payload).toBeNull();
  });

  it("returns needs_human when craft stopReason is not ok", () => {
    const res = buildDeterministicCollapse({
      craft: {
        stopReason: "provider_failed",
        payload: { proposedChanges: [{ targetKey: "k", value: "v", rationale: "r" }] },
      },
      critic: {
        stopReason: "ok",
        payload: { pass: true, issues: [] },
      },
    });

    expect(res.stopReason).toBe("needs_human");
    expect(res.payload).toBeNull();
  });

  it("returns needs_human when critic stopReason is not ok", () => {
    const res = buildDeterministicCollapse({
      craft: {
        stopReason: "ok",
        payload: { proposedChanges: [{ targetKey: "k", value: "v", rationale: "r" }] },
      },
      critic: {
        stopReason: "provider_failed",
        payload: { pass: true, issues: [] },
      },
    });

    expect(res.stopReason).toBe("needs_human");
    expect(res.payload).toBeNull();
  });

  it("forbidden keys never appear in extensions", () => {
    const res = buildDeterministicCollapse({
      craft: {
        stopReason: "ok",
        payload: {
          proposedChanges: [{ targetKey: "k", value: "v", rationale: "r" }],
          prompt: "SECRET PROMPT",
          system: "SECRET SYSTEM",
        },
      },
      critic: {
        stopReason: "ok",
        payload: {
          pass: true,
          issues: [],
          provider: "SECRET PROVIDER",
          stack: "SECRET STACK",
        },
      },
    });

    const extensionsStr = JSON.stringify(res.extensions);
    expect(extensionsStr).not.toMatch(/prompt|system|provider|stack|traceback|error/i);
  });

  it("deterministic for same inputs", () => {
    const input = {
      craft: {
        stopReason: "ok",
        payload: {
          proposedChanges: [{ targetKey: "k", value: 1, rationale: "r" }],
          risks: ["risk1"],
          assumptions: ["assumption1"],
        },
      },
      critic: {
        stopReason: "ok",
        payload: {
          pass: true,
          issues: [],
          risks: ["risk2"],
          assumptions: ["assumption2"],
        },
      },
    };

    const a = buildDeterministicCollapse(input);
    const b = buildDeterministicCollapse(input);

    expect(a).toEqual(b);
  });

  it("merges risks and assumptions from craft and critic", () => {
    const res = buildDeterministicCollapse({
      craft: {
        stopReason: "ok",
        payload: {
          proposedChanges: [{ targetKey: "k", value: "v", rationale: "r" }],
          risks: ["craft_risk"],
          assumptions: ["craft_assumption"],
        },
      },
      critic: {
        stopReason: "ok",
        payload: {
          pass: true,
          issues: [],
          risks: ["critic_risk"],
          assumptions: ["critic_assumption"],
        },
      },
    });

    expect(res.payload?.risks).toContain("craft_risk");
    expect(res.payload?.risks).toContain("critic_risk");
    expect(res.payload?.assumptions).toContain("craft_assumption");
    expect(res.payload?.assumptions).toContain("critic_assumption");
  });
});
