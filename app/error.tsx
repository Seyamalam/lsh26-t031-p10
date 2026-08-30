"use client"

import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>Page unavailable</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-3"><span>The analysis could not be rendered.</span><Button variant="outline" size="sm" onClick={reset}>Try again</Button></AlertDescription>
    </Alert>
  )
}
