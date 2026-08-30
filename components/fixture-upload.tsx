"use client"

import { useState } from "react"
import { Upload } from "lucide-react"

import { useFixture } from "@/components/fixture-provider"
import {
  FileUpload,
  type FileUploadItem,
} from "@/components/motion/file-upload"
import { Button } from "@/components/ui/button"
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
  const [items, setItems] = useState<FileUploadItem[]>([])

  const parseFile = async (item: FileUploadItem, file: File | undefined) => {
    const result = await loadFixture(file)
    setItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              progress: result.ok ? 100 : 0,
              status: result.ok ? "success" : "error",
              error: result.error,
            }
          : entry
      )
    )
    setItems([])
  }

  return (
    <Sheet>
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
