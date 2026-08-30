import { describe, expect, it } from "vitest";
import { calculateRechargeNeed, forecastRunOut } from "./advice";

describe("forecast and recharge advice", () => {
  it("finds the first day whose closing balance is non-positive", () => {
    const result = forecastRunOut({ date: "2026-01-30", balancePoisha: 1_000, monthlyUnits: 74 }, 1);
    expect(result?.date).toBe("2026-02-02");
    expect(result?.days).toBe(3);
  });

  it("returns zero when the existing balance lasts through target", () => {
    const result = calculateRechargeNeed(
      { date: "2026-01-01", balancePoisha: 100_000, monthlyUnits: 0 },
      "2026-01-03",
      1,
      false,
    );
    expect(result.rechargeNeededPoisha).toBe(0);
    expect(result.fixedPoisha).toBe(0);
  });

  it("adds fixed charges only when today's recharge is the month's first", () => {
    const state = { date: "2026-01-01", balancePoisha: 0, monthlyUnits: 0 };
    const first = calculateRechargeNeed(state, "2026-01-02", 1, false);
    const later = calculateRechargeNeed(state, "2026-01-02", 1, true);
    expect(first.rechargeNeededPoisha - later.rechargeNeededPoisha).toBe(8_200);
    expect(first.baselineEnergyPoisha + first.higherSlabPoisha).toBe(first.energyPoisha);
  });
});
