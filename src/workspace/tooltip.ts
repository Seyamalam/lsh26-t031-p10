type TooltipPayload = {
  dataKey?: string | number
  value?: unknown
  payload?: Record<string, unknown>
}
export function balanceTooltipItems(
  payload: TooltipPayload[]
): { label: "Balance" | "Recharge"; value: number }[] {
  const row = payload.find((item) => item.payload)?.payload
  const balance = Number(row?.balance)
  const recharge = Number(row?.recharge)
  const items: { label: "Balance" | "Recharge"; value: number }[] = []
  if (Number.isFinite(balance)) items.push({ label: "Balance", value: balance })
  if (Number.isFinite(recharge) && recharge > 0)
    items.push({ label: "Recharge", value: recharge })
  return items
}
