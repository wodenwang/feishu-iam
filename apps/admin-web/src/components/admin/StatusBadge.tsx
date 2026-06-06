import type { ReactNode } from "react";
import { Badge } from "../ui/badge";

export type StatusBadgeTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
  ariaLabel?: string;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  success:
    "border-transparent bg-[hsl(var(--status-success))] text-[hsl(var(--status-success-foreground))]",
  warning:
    "border-transparent bg-[hsl(var(--status-warning))] text-[hsl(var(--status-warning-foreground))]",
  danger: "border-transparent bg-destructive text-destructive-foreground",
  info:
    "border-transparent bg-[hsl(var(--status-info))] text-[hsl(var(--status-info-foreground))]",
  muted: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({
  children,
  tone = "default",
  ariaLabel,
}: StatusBadgeProps) {
  return (
    <Badge
      aria-label={ariaLabel}
      className={`shrink-0 whitespace-nowrap ${toneClasses[tone]}`}
      variant="outline"
    >
      {children}
    </Badge>
  );
}
