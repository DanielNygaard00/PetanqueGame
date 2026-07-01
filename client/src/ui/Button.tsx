import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" };

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  const base = "inline-flex items-center justify-center rounded-card px-4 py-2 font-semibold transition disabled:opacity-50";
  const styles = variant === "primary"
    ? "bg-terracotta text-cream hover:bg-terracotta/90 shadow-card"
    : "bg-transparent text-ink hover:bg-ink/5 border border-ink/15";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}
