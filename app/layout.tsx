import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { AppShell } from "@/components/app-shell"
import { FixtureProvider } from "@/components/fixture-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Meterwise | Prepaid Recharge Advisor",
  description: "P10 prepaid meter ledger, recharge forecast, and three-month policy comparison.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <ThemeProvider defaultTheme="system" enableSystem>
          <TooltipProvider>
            <FixtureProvider>
              <AppShell>{children}</AppShell>
            </FixtureProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
