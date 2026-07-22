import { describe, expect, it } from "@effect/vitest";
import { getModelCostLabel, getModelCostTier } from "./modelCost";

describe("model cost labels", () => {
  it("uses the requested relative tiers", () => {
    expect(getModelCostLabel({ slug: "fable", name: "Fable" })).toBe("$$$$");
    expect(getModelCostLabel({ slug: "claude-opus-4-6", name: "Opus" })).toBe("$$$");
    expect(getModelCostLabel({ slug: "claude-sonnet-4-6", name: "Sonnet" })).toBe("$$");
    expect(getModelCostLabel({ slug: "claude-haiku-4-5", name: "Haiku" })).toBe("$");
  });

  it("gives unknown and custom models a visible middle tier", () => {
    expect(getModelCostTier({ slug: "custom-model", name: "Custom model" })).toBe(2);
  });
});
