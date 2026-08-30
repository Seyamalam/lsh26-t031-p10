import { describe, expect, it } from "vitest";
import { allocateSlabs, energyCost } from "./tariff";
import { vatOnEnergy } from "./money";

describe("progressive tariff allocation", () => {
  it.each([
    [74, 2, [1, 1], 463 + 526],
    [199, 2, [1, 1], 526 + 563],
    [299, 2, [1, 1], 563 + 583],
    [399, 2, [1, 1], 583 + 930],
    [599, 2, [1, 1], 930 + 1070],
  ])("crosses a slab at %i monthly units", (before, units, parts, expected) => {
    const allocations = allocateSlabs(before, units);
    expect(allocations.map((item) => item.units)).toEqual(parts);
    expect(energyCost(allocations)).toBe(expected);
  });

  it("splits one unusually heavy day over several slabs", () => {
    const allocations = allocateSlabs(70, 350);
    expect(allocations.map(({ units }) => units)).toEqual([5, 125, 100, 100, 20]);
    expect(allocations.reduce((sum, item) => sum + item.units, 0)).toBe(350);
  });

  it("rounds five percent VAT to the nearest poisha", () => {
    expect(vatOnEnergy(463)).toBe(23);
    expect(vatOnEnergy(526)).toBe(26);
  });
});
