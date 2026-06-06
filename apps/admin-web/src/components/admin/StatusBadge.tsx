import type { ReactNode } from "react";
import { Badge } from "../ui/badge";

export type StatusBadgeTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
  ariaLabel?: string;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  success: "border-transparent bg-emerald-600 text-white",
  warning: "border-transparent bg-amber-500 text-white",
  danger: "border-transparent bg-destructive text-destructive-foreground",
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
