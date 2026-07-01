// client/src/components/InsightsBar.tsx
import { Card } from "../ui/Card";

type Row = { key: string; games: number; winRate: number; avgMargin: number };

export function InsightsBar({ title, rows }: { title: string; rows: Row[] }) {
  const max = 100;
  return (
    <Card>
      <h3 className="mb-3 font-display text-lg">{title}</h3>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 && <li className="text-ink/40">Ingen data endnu</li>}
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex justify-between">
              <span>{r.key}</span>
              <span className="text-ink/60">{r.winRate.toFixed(0)}% · {r.games} kampe · margin {r.avgMargin >= 0 ? "+" : ""}{r.avgMargin.toFixed(1)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-ink/10">
              <div className="h-1.5 rounded-full bg-terracotta" style={{ width: `${(r.winRate / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
