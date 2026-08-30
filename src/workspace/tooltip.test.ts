import { describe, expect, it } from "vitest"

import { BALANCE_CHART_SERIES, balanceTooltipItems } from "./tooltip"

describe("balance tooltip", () => {
  it("keeps the daily line and recharge markers on separate series", () => {
    expect(BALANCE_CHART_SERIES).toEqual({
      dailyLine: "balance",
      rechargeMarker: "markerBalance",
    })
  })

  it("renders one balance and one recharge from shared chart payloads", () => {
    const payload = [
      {
        dataKey: "balance",
        value: 410,
        payload: { balance: 410, recharge: 500, markerBalance: 410 },
      },
      {
        dataKey: "markerBalance",
        value: 410,
        payload: { balance: 410, recharge: 500, markerBalance: 410 },
      },
    ]
    expect(balanceTooltipItems(payload)).toEqual([
      { label: "Balance", value: 410 },
      { label: "Recharge", value: 500 },
    ])
  })

  it("omits recharge on ordinary days and never returns NaN", () => {
    expect(
      balanceTooltipItems([
        {
          dataKey: "balance",
          value: 20,
          payload: { balance: 20, recharge: 0 },
        },
      ])
    ).toEqual([{ label: "Balance", value: 20 }])
    expect(
      balanceTooltipItems([
        { dataKey: "balance", value: Number.NaN, payload: {} },
      ])
    ).toEqual([])
  })
})
