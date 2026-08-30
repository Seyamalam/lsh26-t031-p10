"use client"

import { useState } from "react"
import { Upload } from "lucide-react"

import { type ImportMode, useFixture } from "@/components/fixture-provider"
import {
  FileUpload,
  type FileUploadItem,
} from "@/components/motion/file-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { settleUploadQueue } from "@/src/data/upload-queue"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export function FixtureUpload() {
  const { loadFixture } = useFixture()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<FileUploadItem[]>([])
  const [mode, setMode] = useState<ImportMode>("once")
  const [name, setName] = useState("")

  const parseFile = async (item: FileUploadItem, file: File | undefined) => {
    const result = await loadFixture(file, mode, name || undefined)
    setItems((current) => settleUploadQueue(current, item.id, result))
    if (result.ok) setOpen(false)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <Upload data-icon="inline-start" />
        <span className="hidden lg:inline">Load JSON</span>
        <span className="sr-only lg:hidden">Load JSON fixture</span>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Load fixture JSON</SheetTitle>
          <SheetDescription>
            The file is parsed locally and replaces the active case set
            immediately.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <fieldset className="mb-4 grid gap-2">
            <legend className="mb-1 text-xs font-medium">Storage choice</legend>
            <label className="flex cursor-pointer gap-3 rounded-md border p-3">
              <input
                type="radio"
                name="fixture-mode"
                value="once"
                checked={mode === "once"}
                onChange={() => setMode("once")}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Use once</span>
                <span className="block text-xs text-muted-foreground">
                  Keep it in memory until refresh.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-md border p-3">
              <input
                type="radio"
                name="fixture-mode"
                value="save"
                checked={mode === "save"}
                onChange={() => setMode("save")}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">
                  Save on this device
                </span>
                <span className="block text-xs text-muted-foreground">
                  Store the original JSON and validated data in this browser.
                </span>
              </span>
            </label>
          </fieldset>
          {mode === "save" && (
            <div className="mb-4 grid gap-1.5">
              <Label htmlFor="dataset-name">Dataset name</Label>
              <Input
                id="dataset-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Defaults to filename"
              />
            </div>
          )}
          <p className="mb-4 rounded-md bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            Privacy: saved JSON stays in this browser&apos;s IndexedDB. It is
            not uploaded to a server. Remove it any time from Datasets.
          </p>
          <FileUpload
            accept="application/json,.json"
            multiple={false}
            maxFiles={1}
            value={items}
            onValueChange={setItems}
            onFilesAdded={(added, files) => void parseFile(added[0], files[0])}
            onRetry={(item) => void parseFile(item, item.file)}
            title="Drop fixture JSON"
            description="One P10 JSON file · processed on this device"
            browseLabel="Choose file"
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
