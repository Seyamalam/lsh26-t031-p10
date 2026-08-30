import type { SlabAllocation } from "./types";

export const FIXED_CHARGES_POISHA = 8_200;
export const DEMAND_CHARGE_POISHA = 4_200;
export const METER_RENT_POISHA = 4_000;
export const FIRST_SLAB_RATE_POISHA = 463;

export const SLABS = [
  { from: 1, to: 75, ratePoisha: 463 },
  { from: 76, to: 200, ratePoisha: 526 },
  { from: 201, to: 300, ratePoisha: 563 },
  { from: 301, to: 400, ratePoisha: 583 },
  { from: 401, to: 600, ratePoisha: 930 },
  { from: 601, to: null, ratePoisha: 1070 },
] as const;

export function allocateSlabs(monthlyUnitsBefore: number, units: number): SlabAllocation[] {
  if (!Number.isInteger(monthlyUnitsBefore) || monthlyUnitsBefore < 0) throw new Error("Monthly units must be a non-negative integer.");
  if (!Number.isInteger(units) || units < 0) throw new Error("Daily units must be a non-negative integer.");
  let cursor = monthlyUnitsBefore;
  let remaining = units;
  const result: SlabAllocation[] = [];

  for (const slab of SLABS) {
    if (remaining === 0) break;
    if (slab.to !== null && cursor >= slab.to) continue;
    const capacity = slab.to === null ? remaining : slab.to - cursor;
    const allocated = Math.min(remaining, capacity);
    if (allocated <= 0) continue;
    result.push({
      label: slab.to === null ? `${slab.from}+` : `${slab.from}–${slab.to}`,
      from: slab.from,
      to: slab.to,
      units: allocated,
      ratePoisha: slab.ratePoisha,
      costPoisha: allocated * slab.ratePoisha,
    });
    cursor += allocated;
    remaining -= allocated;
  }
  return result;
}

export const energyCost = (allocations: SlabAllocation[]) =>
  allocations.reduce((total, item) => total + item.costPoisha, 0);
