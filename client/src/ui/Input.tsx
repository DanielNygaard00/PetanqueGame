import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };

export const Input = forwardRef<HTMLInputElement, Props>(({ label, error, className = "", ...rest }, ref) => (
  <label className="block">
    {label && <span className="mb-1 block text-sm font-medium text-ink/80">{label}</span>}
    <input ref={ref} className={`w-full rounded-card border border-ink/15 bg-cream px-3 py-2 outline-none focus:border-terracotta ${className}`} {...rest} />
    {error && <span className="mt-1 block text-sm text-bordeaux">{error}</span>}
  </label>
));
Input.displayName = "Input";
