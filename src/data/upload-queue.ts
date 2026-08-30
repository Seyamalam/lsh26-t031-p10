type UploadQueueItem = {
  id: string
  progress?: number
  status?: string
  error?: string
}

type UploadResult = { ok: boolean; error?: string }

export function settleUploadQueue<T extends UploadQueueItem>(
  items: T[],
  itemId: string,
  result: UploadResult
): T[] {
  if (result.ok) return []
  return items.map((entry) =>
    entry.id === itemId
      ? ({
          ...entry,
          progress: 0,
          status: "error",
          error: result.error,
        } as T)
      : entry
  )
}
