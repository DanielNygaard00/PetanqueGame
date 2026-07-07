// client/src/pages/RankingsPage.tsx
import { useMemo } from "react";
import { useMatches } from "../api/hooks";
import { computeElo } from "../stats/elo";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCards } from "../ui/Skeleton";

export function RankingsPage() {
  const { data = [], isLoading } = useMatches();
  const ratings = useMemo(() => computeElo(data), [data]);
  const podium = ratings.length >= 3 ? ratings.slice(0, 3) : [];
  const rest = podium.length ? ratings.slice(3) : ratings;
  const startRank = podium.length ? 4 : 1;
  if (isLoading) return <SkeletonCards count={5} />;
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Rangliste</h2>
      {ratings.length === 0 ? (
        <EmptyState emoji="🏆" title="Ranglisten er tom" hint="Log kampe med point for at se Elo-ratings." cta={{ label: "Log kamp", to: "/matches/new" }} />
      ) : (
        <>
          {podium.length === 3 && (
            <div className="grid grid-cols-3 items-end gap-2">
              {[
                { p: podium[1], medal: "🥈", accent: "border-ink/30", pad: "pt-4" },
                { p: podium[0], medal: "🥇", accent: "border-gold", pad: "pt-8" },
                { p: podium[2], medal: "🥉", accent: "border-terracotta/60", pad: "pt-2" },
              ].map(({ p, medal, accent, pad }) => (
                <Card key={p.name} className={`flex flex-col items-center gap-1 border-2 text-center ${accent} ${pad}`}>
                  <span className="text-2xl">{medal}</span>
                  <span className="max-w-full truncate font-medium">{p.name}</span>
                  <span className="font-display text-2xl text-terracotta">{p.elo}</span>
                  <span className="text-xs text-ink/50">{p.games} kampe</span>
                </Card>
              ))}
            </div>
          )}

          {/* Desktop table */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink/60">
                <th className="py-2">#</th><th>Spiller</th><th>Elo</th><th>Kampe</th><th>V–T</th><th>Sejr%</th><th>Margin</th><th>Form</th>
              </tr></thead>
              <tbody>
                {rest.map((p, i) => (
                  <tr key={p.name} className="border-t border-ink/10">
                    <td className="py-2">{startRank + i}</td>
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
            {rest.map((p, i) => (
              <Card key={p.name} className="flex items-start gap-3">
                <span className="w-6 shrink-0 pt-0.5 text-sm text-ink/40 font-medium">{startRank + i}</span>
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
