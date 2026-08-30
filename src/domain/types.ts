export type DayReading = { date: string; units: number };
export type Recharge = { date: string; amount_bdt: string };

export type ComparisonConfig = {
  months: string[];
  source: "readings" | "daily_units";
  daily_units: number | null;
  opening_balance_bdt: string;
  low_threshold_bdt: string;
  low_amount_bdt: string;
  monthly_amount_bdt: string;
};

export type MeterCase = {
  case_id: string;
  opening_balance_bdt: string;
  days: DayReading[];
  recharges: Recharge[];
  today: string;
  usual_daily_units: number;
  target_date: string;
  comparison: ComparisonConfig;
};

export type FixtureDocument = {
  schema_version: string;
  problem_id: "P10";
  format_note?: string;
  cases: MeterCase[];
};

export type SlabAllocation = {
  label: string;
  from: number;
  to: number | null;
  units: number;
  ratePoisha: number;
  costPoisha: number;
};

export type DailyLedgerRow = {
  date: string;
  openingBalancePoisha: number;
  rechargePoisha: number;
  fixedChargesPoisha: number;
  monthlyUnitsBefore: number;
  units: number;
  monthlyUnitsAfter: number;
  slabAllocations: SlabAllocation[];
  energyCostPoisha: number;
  vatPoisha: number;
  closingBalancePoisha: number;
};

export type CostTotals = {
  energyPoisha: number;
  vatPoisha: number;
  fixedPoisha: number;
  costPoisha: number;
  depositsPoisha: number;
  endingBalancePoisha: number;
  rechargeCount: number;
};
