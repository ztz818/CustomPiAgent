import type { HTMLAttributes, ReactNode } from "react";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  level?: "base" | "container" | "high";
  children: ReactNode;
}

export function Surface({ level = "base", children, style, ...props }: SurfaceProps) {
  const background =
    level === "high" ? "var(--surface-container-high)" :
    level === "container" ? "var(--surface-container)" :
    "var(--surface)";

  return (
    <div
      style={{
        background,
        color: "var(--text)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
