// client/src/pages/RankingsPage.tsx
import { useMemo } from "react";
import { useMatches } from "../api/hooks";
import { computeElo } from "../stats/elo";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";

export function RankingsPage() {
  const { data = [], isLoading } = useMatches();
  if (isLoading) return <p>Henter…</p>;
  const ratings = useMemo(() => computeElo(data), [data]);
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Rangliste</h2>
      {ratings.length === 0 ? (
        <Card><p className="text-ink/50">Ingen 1-mod-1 kampe endnu — log nogle for at se ratings.</p></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink/60">
                <th className="py-2">#</th><th>Spiller</th><th>Elo</th><th>Kampe</th><th>V–T</th><th>Sejr%</th><th>Margin</th><th>Form</th>
              </tr></thead>
              <tbody>
                {ratings.map((p, i) => (
                  <tr key={p.name} className="border-t border-ink/10">
                    <td className="py-2">{i + 1}</td>
                    <td className="font-medium">{p.name} {p.provisional && <Badge tone="group">foreløbig</Badge>}</td>
                    <td className="font-display text-terracotta">{p.elo}</td>
                    <td>{p.games}</td>
                    <td>{p.wins}–{p.losses}</td>
                    <td>{p.winRate.toFixed(0)}%</td>
                    <td>{p.avgMargin >= 0 ? "+" : ""}{p.avgMargin.toFixed(1)}</td>
                    <td className="tracking-wide">{p.form.map((f, j) => <span key={j} className={f === "W" ? "text-olive" : "text-bordeaux"}>{f}</span>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {ratings.map((p, i) => (
              <Card key={p.name} className="flex items-start gap-3">
                <span className="w-6 shrink-0 pt-0.5 text-sm text-ink/40 font-medium">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink">{p.name}</span>
                    {p.provisional && <Badge tone="group">foreløbig</Badge>}
                    <span className="font-display text-lg text-terracotta ml-auto">{p.elo}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink/50">
                    {p.games} kampe · {p.wins}–{p.losses} · {p.winRate.toFixed(0)}% · form{" "}
                    <span className="tracking-wide">{p.form.map((f, j) => <span key={j} className={f === "W" ? "text-olive" : "text-bordeaux"}>{f}</span>)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
