"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Minimal stub for Highlight primitives — provides hover highlight container
// Original unlumen-ui Highlight provides a moving background highlight for parent/child items.
// This stub preserves the API so motion-navigation-menu works without the full library.

type HighlightProps = React.HTMLAttributes<HTMLDivElement> & {
  mode?: "parent" | "children";
  controlledItems?: boolean;
  hover?: boolean;
  containerClassName?: string;
};

export function Highlight({
  className,
  containerClassName,
  children,
  style,
  ...props
}: HighlightProps) {
  return (
    <div className={cn("relative", containerClassName)} style={style}>
      {/* The highlight background is absolutely positioned via the parent's className + style
          In stub mode we just render children without the animated highlight */}
      {children}
    </div>
  );
}

type HighlightItemProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean;
};

export function HighlightItem({ asChild, children, className, ...props }: HighlightItemProps) {
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    const existingClass = (child.props as { className?: string })?.className || "";
    return React.cloneElement(child, {
      className: cn(existingClass, className),
      ...props,
    } as any);
  }
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
