"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--color-paper)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-rule)",
          "--border-radius": "6px",
          fontFamily: "var(--font-body)",
          fontSize: "13px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "!bg-paper !border !border-rule !shadow-paper !rounded-md " +
            "!font-display !text-[14px] !text-ink",
          title: "!text-ink",
          description: "!text-ink-soft",
          actionButton: "!text-clay",
          cancelButton: "!text-ink-faint",
          error: "!border-error !text-error",
          success: "!border-clay !text-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
