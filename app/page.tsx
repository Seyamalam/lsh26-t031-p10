import MeterAdvisor from "@/components/meter-advisor"
import fixture from "@/public/data/P10_prepaid_meter_public.json"
import type { FixtureDocument } from "@/src/domain/types"

export default function Page() {
  return <MeterAdvisor publishedFixture={fixture as FixtureDocument} />
}
