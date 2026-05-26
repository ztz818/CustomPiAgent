"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonTone = "default" | "selected" | "primary";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: IconButtonTone;
  size?: number;
  children: ReactNode;
}

export function IconButton({
  label,
  tone = "default",
  size = 36,
  children,
  style,
  disabled,
  onMouseEnter,
  onMouseLeave,
  ...props
}: IconButtonProps) {
  const isSelected = tone === "selected";
  const isPrimary = tone === "primary";

  return (
    <button
      type="button"
      aria-label={label}
      title={props.title ?? label}
      disabled={disabled}
      {...props}
      style={{
        width: size,
        height: size,
        minWidth: size,
        border: "none",
        borderRadius: 8,
        background: isPrimary ? "var(--accent)" : isSelected ? "var(--bg-selected)" : "transparent",
        color: isPrimary ? "var(--on-primary)" : isSelected ? "var(--accent)" : "var(--text-muted)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : 1,
        padding: 0,
        transition: "background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
        ...style,
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        if (event.defaultPrevented || disabled || isPrimary) return;
        event.currentTarget.style.background = isSelected ? "var(--bg-selected)" : "var(--bg-hover)";
        event.currentTarget.style.color = isSelected ? "var(--accent)" : "var(--text)";
      }}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        if (event.defaultPrevented || disabled || isPrimary) return;
        event.currentTarget.style.background = isSelected ? "var(--bg-selected)" : "transparent";
        event.currentTarget.style.color = isSelected ? "var(--accent)" : "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}
