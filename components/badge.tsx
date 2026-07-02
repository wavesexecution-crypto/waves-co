import { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
};

export function Badge({ children }: BadgeProps) {
  return (
    <span className="inline-flex min-h-8 w-fit items-center rounded-sm border border-line bg-white px-3 font-mono text-xs uppercase tracking-[0.14em] text-navy">
      {children}
    </span>
  );
}
