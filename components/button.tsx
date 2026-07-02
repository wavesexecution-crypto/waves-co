import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
};

const variants = {
  primary:
    "border-accent bg-accent text-navy-dark shadow-sm hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_4px_12px_rgba(0,194,209,0.12)]",
  secondary:
    "border-line bg-white text-navy hover:-translate-y-0.5 hover:border-navy/45 hover:bg-paper hover:shadow-[0_4px_12px_rgba(6,20,46,0.04)]",
  ghost:
    "border-transparent bg-transparent text-navy hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_4px_12px_rgba(6,20,46,0.02)]",
};

const base =
  "focus-ring group inline-flex h-12 items-center justify-center gap-2 rounded-sm border px-6 text-sm font-semibold leading-none transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]";

export function Button({
  children,
  href,
  type = "button",
  variant = "primary",
  className = "",
  onClick,
}: ButtonProps) {
  const classes = `${base} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        <span>{children}</span>
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
          size={17}
          strokeWidth={1.9}
        />
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onClick}>
      <span>{children}</span>
      <ArrowRight
        aria-hidden="true"
        className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1"
        size={17}
        strokeWidth={1.9}
      />
    </button>
  );
}
