import { describe, expect, it } from "vitest"

import { settleUploadQueue } from "./upload-queue"

const item = {
  id: "fixture-1",
  name: "fixture.json",
  progress: 0,
  status: "uploading" as const,
}

describe("fixture upload queue", () => {
  it("keeps a rejected file and its exact error for retry or removal", () => {
    expect(
      settleUploadQueue([item], item.id, {
        ok: false,
        error: "The selected file is not valid JSON.",
      })
    ).toEqual([
      {
        ...item,
        progress: 0,
        status: "error",
        error: "The selected file is not valid JSON.",
      },
    ])
  })

  it("clears the one-file queue after a successful replacement", () => {
    expect(settleUploadQueue([item], item.id, { ok: true })).toEqual([])
  })
})
