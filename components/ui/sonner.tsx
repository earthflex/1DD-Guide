"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Status colours (richColors): green = done, red = failed, amber = caution, orange = 1DD info.
          "--success-bg": "oklch(0.97 0.03 155)",
          "--success-border": "oklch(0.87 0.08 155)",
          "--success-text": "oklch(0.42 0.11 155)",
          "--error-bg": "oklch(0.97 0.02 25)",
          "--error-border": "oklch(0.86 0.07 25)",
          "--error-text": "oklch(0.5 0.19 27)",
          "--warning-bg": "oklch(0.98 0.04 90)",
          "--warning-border": "oklch(0.88 0.1 85)",
          "--warning-text": "oklch(0.5 0.12 65)",
          "--info-bg": "oklch(0.97 0.03 55)",
          "--info-border": "oklch(0.86 0.09 50)",
          "--info-text": "oklch(0.52 0.17 45)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
