import { describe, expect, it } from "vitest";
import { runDailyLedger } from "./ledger";

describe("daily ledger", () => {
  it("orders recharge and one monthly fixed charge before consumption", () => {
    const rows = runDailyLedger(
      10_000,
      [
        { date: "2026-01-01", units: 1 },
        { date: "2026-01-02", units: 1 },
      ],
      [
        { date: "2026-01-01", amount_bdt: "100.00" },
        { date: "2026-01-02", amount_bdt: "100.00" },
      ],
    );
    expect(rows[0].fixedChargesPoisha).toBe(8_200);
    expect(rows[1].fixedChargesPoisha).toBe(0);
    expect(rows[0].closingBalancePoisha).toBe(10_000 + 10_000 - 8_200 - 463 - 23);
  });

  it("resets units at a calendar month, never on recharge", () => {
    const rows = runDailyLedger(
      0,
      [
        { date: "2026-01-31", units: 80 },
        { date: "2026-02-01", units: 2 },
      ],
      [{ date: "2026-01-31", amount_bdt: "1000.00" }],
    );
    expect(rows[0].slabAllocations).toHaveLength(2);
    expect(rows[1].monthlyUnitsBefore).toBe(0);
    expect(rows[1].slabAllocations[0].ratePoisha).toBe(463);
  });

  it("takes no fixed charge in a month without a recharge", () => {
    const [row] = runDailyLedger(0, [{ date: "2026-01-01", units: 0 }], []);
    expect(row.fixedChargesPoisha).toBe(0);
  });
});
