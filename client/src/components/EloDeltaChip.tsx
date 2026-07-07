// client/src/components/EloDeltaChip.tsx
export function EloDeltaChip({ delta, suffix }: { delta: number; suffix?: string }) {
  const tone = delta > 0 ? "text-olive" : delta < 0 ? "text-bordeaux" : "text-ink/50";
  const text = delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "±0";
  return (
    <span className={`text-sm font-medium ${tone}`}>
      {text}{suffix ? ` ${suffix}` : ""}
    </span>
  );
}
