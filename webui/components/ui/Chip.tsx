"use client";

import type { HTMLAttributes, ReactNode } from "react";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode;
  tone?: "default" | "selected" | "danger" | "warning";
  children: ReactNode;
}

export function Chip({ icon, tone = "default", children, style, ...props }: ChipProps) {
  const color =
    tone === "danger" ? "var(--error)" :
    tone === "warning" ? "var(--warning)" :
    tone === "selected" ? "var(--accent)" :
    "var(--text-muted)";

  return (
    <span
      style={{
        alignItems: "center",
        background: tone === "default" ? "var(--bg-panel)" : "var(--bg-selected)",
        border: "1px solid var(--outline-variant)",
        borderRadius: 999,
        color,
        display: "inline-flex",
        fontSize: 11,
        fontVariantNumeric: "tabular-nums",
        fontWeight: tone === "default" ? 500 : 600,
        gap: 4,
        height: 24,
        lineHeight: 1,
        padding: "0 8px",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
