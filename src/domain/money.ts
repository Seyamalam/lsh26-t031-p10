export const POISHA_PER_BDT = 100;

export function parseBdt(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`Invalid BDT amount: ${value}`);
  }
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatBdt(poisha: number): string {
  const sign = poisha < 0 ? "−" : "";
  const absolute = Math.abs(poisha);
  return `${sign}৳${(absolute / 100).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function vatOnEnergy(energyPoisha: number): number {
  return Math.floor((energyPoisha * 5 + 50) / 100);
}
