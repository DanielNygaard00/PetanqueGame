// client/src/components/PredictionBar.tsx
export function PredictionBar({ probA, labelA, labelB }: { probA: number; labelA: string; labelB: string }) {
  const pctA = Math.round(probA * 100);
  const pctB = 100 - pctA;
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-sm text-ink/70">
        <span className="truncate">{labelA} · {pctA}%</span>
        <span className="truncate">{pctB}% · {labelB}</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-terracotta" style={{ width: `${pctA}%` }} />
        <div className="bg-steel" style={{ width: `${pctB}%` }} />
      </div>
    </div>
  );
}
