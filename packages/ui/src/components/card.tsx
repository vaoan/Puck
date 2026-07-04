import type { HTMLAttributes } from "react";

import { cn } from "@/utils/cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * Chunky rounded flat card — README §4 "Shape, spacing, elevation":
 * 20px radius, hairline border, no shadow (elevation comes from flat color
 * blocks and spacing, not drop shadows).
 */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn("bg-card border-border rounded-lg border p-4", className)}
      {...props}
    />
  );
}
