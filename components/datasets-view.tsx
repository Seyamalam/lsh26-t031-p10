"use client"

import { useState } from "react"
import {
  Database,
  Download,
  FolderOpen,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react"

import { useFixture } from "@/components/fixture-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DatasetsView() {
  const {
    savedDatasets,
    datasetId,
    workspaceReady,
    selectDataset,
    renameDataset,
    replaceDataset,
    deleteDataset,
    clearSavedDatasets,
    exportDataset,
  } = useFixture()
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null
  )

  const run = async (action: () => Promise<void>) => {
    try {
      setError("")
      await action()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Dataset action failed."
      )
    }
  }
  const download = (rawJson: string, filename: string) => {
    const url = URL.createObjectURL(
      new Blob([rawJson], { type: "application/json" })
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Datasets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browser-local fixture catalog and provenance.
          </p>
        </div>
        {savedDatasets.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() =>
              window.confirm(
                "Delete every saved dataset and its controls from this browser?"
              ) && void run(clearSavedDatasets)
            }
          >
            <Trash2 data-icon="inline-start" /> Clear all
          </Button>
        )}
      </div>
      <Alert className="border-teal-500/30 bg-teal-500/5">
        <Database />
        <AlertTitle>Stored only on this device</AlertTitle>
        <AlertDescription>
          Original JSON, validated data, provenance, last case, and user
          controls use IndexedDB. Ledger and analysis results are recomputed and
          are not persisted.
        </AlertDescription>
      </Alert>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Dataset action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!workspaceReady ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Opening device workspace...
          </CardContent>
        </Card>
      ) : savedDatasets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium">No saved datasets</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose Save on this device from Load JSON.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {savedDatasets.map((item) => (
            <Card
              key={item.id}
              className={item.id === datasetId ? "ring-2 ring-primary/50" : ""}
            >
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">{item.name}</CardTitle>
                    <CardDescription className="mt-1 truncate">
                      {item.sourceFilename}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={item.id === datasetId ? "default" : "outline"}
                  >
                    {item.id === datasetId ? "Open" : "Saved"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <Meta label="Cases" value={String(item.caseCount)} />
                  <Meta
                    label="Readings"
                    value={item.totalReadings.toLocaleString("en-BD")}
                  />
                  <Meta
                    label="Date range"
                    value={`${item.earliestDate} to ${item.latestDate}`}
                  />
                  <Meta
                    label="Size"
                    value={`${(item.byteSize / 1024).toFixed(1)} KiB`}
                  />
                  <Meta
                    label="Imported"
                    value={new Date(item.importedAt).toLocaleString("en-BD")}
                  />
                  <Meta
                    label="Schema"
                    value={`${item.problemId} · ${item.schemaVersion}`}
                  />
                </dl>
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    SHA-256 fingerprint
                  </p>
                  <code className="mt-1 block overflow-x-auto rounded bg-muted p-2 text-[10px]">
                    {item.fingerprint}
                  </code>
                </div>
                {editing?.id === item.id && (
                  <div className="flex gap-2">
                    <div className="grid min-w-0 flex-1 gap-1">
                      <Label htmlFor={`rename-${item.id}`}>Dataset name</Label>
                      <Input
                        id={`rename-${item.id}`}
                        value={editing.name}
                        onChange={(event) =>
                          setEditing({ id: item.id, name: event.target.value })
                        }
                      />
                    </div>
                    <Button
                      className="self-end"
                      size="sm"
                      onClick={() =>
                        void run(async () => {
                          await renameDataset(item.id, editing.name)
                          setEditing(null)
                        })
                      }
                    >
                      Save
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void run(() => selectDataset(item.id))}
                  >
                    <FolderOpen data-icon="inline-start" /> Open
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing({ id: item.id, name: item.name })}
                  >
                    <Pencil data-icon="inline-start" /> Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void run(async () =>
                        download(
                          await exportDataset(item.id),
                          item.sourceFilename || `${item.name}.json`
                        )
                      )
                    }
                  >
                    <Download data-icon="inline-start" /> Export original
                  </Button>
                  <Label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium">
                    <RefreshCcw className="size-3.5" /> Replace
                    <input
                      className="sr-only"
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) void run(() => replaceDataset(item.id, file))
                        event.currentTarget.value = ""
                      }}
                    />
                  </Label>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      window.confirm(
                        `Delete “${item.name}” from this browser?`
                      ) && void run(() => deleteDataset(item.id))
                    }
                  >
                    <Trash2 data-icon="inline-start" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono tabular-nums">{value}</dd>
    </div>
  )
}
