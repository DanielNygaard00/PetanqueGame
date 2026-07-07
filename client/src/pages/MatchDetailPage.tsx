// client/src/pages/MatchDetailPage.tsx
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useMatches } from "../api/hooks";
import { computeEloWithHistory } from "../stats/elo";
import { isGroup } from "../stats/perspective";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { EloDeltaChip } from "../components/EloDeltaChip";
import { SkeletonCards } from "../ui/Skeleton";
import { useAuth } from "../auth/AuthContext";
import { rivalryPath } from "../stats/rivalry";
import type { Drink } from "../api/types";

const drinkLabel = (d: Drink) =>
  [d.type, d.brand, d.name].filter(Boolean).join(" · ") || "Ukendt";

export function MatchDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const viewer = user?.username;
  const { data: matches = [], isLoading } = useMatches();
  const { deltas } = useMemo(() => computeEloWithHistory(matches), [matches]);
  const m = matches.find((x) => x.id === id);

  if (isLoading) return <SkeletonCards count={3} />;
  if (!m) {
    return (
      <div className="space-y-3">
        <p>Kamp ikke fundet.</p>
        <Link to="/matches" className="text-terracotta">Tilbage til kampe</Link>
      </div>
    );
  }

  const matchDeltas = deltas.get(m.id);
  const drinksByPlayer = new Map<string, Drink[]>();
  for (const d of m.drinks ?? []) {
    const key = d.player ?? "Fælles";
    drinksByPlayer.set(key, [...(drinksByPlayer.get(key) ?? []), d]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">{m.Dato}{m.Tid ? ` · ${m.Tid}` : ""}</h2>
          <div className="text-sm text-ink/60">
            {m.Arena}{m["Spillets genstande"] ? ` · ${m["Spillets genstande"]}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGroup(m) && <Badge tone="group">Gruppe</Badge>}
          <Link to={`/matches/${m.id}/edit`}><Button variant="ghost">Rediger</Button></Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(m.teams ?? []).map((t) => (
          <Card key={t.team} className={t.won ? "border-olive" : undefined}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg">{t.won ? "Vinder" : `Hold ${t.team + 1}`}</h3>
              {t.score != null && <span className="font-display text-2xl">{t.score}</span>}
            </div>
            <ul className="mt-2 space-y-1">
              {t.players.map((p) => {
                const d = matchDeltas?.get(p.name);
                return (
                  <li key={p.id} className="flex items-center justify-between text-sm">
                    {viewer && p.name !== viewer
                      ? <Link to={rivalryPath(viewer, p.name)} className="hover:text-terracotta underline decoration-ink/20 underline-offset-2">{p.name}</Link>
                      : <span>{p.name}</span>}
                    {d !== undefined && <EloDeltaChip delta={d} suffix="Elo" />}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      {drinksByPlayer.size > 0 && (
        <Card>
          <h3 className="mb-2 font-display text-lg">Drikkevarer</h3>
          <div className="space-y-3">
            {[...drinksByPlayer.entries()].map(([player, drinks]) => (
              <div key={player}>
                <div className="text-sm font-medium">{player}</div>
                <ul className="text-sm text-ink/70">
                  {drinks.map((d, i) => (
                    <li key={i}>
                      {drinkLabel(d)} — {d.count ?? 1} stk{d.volumeCl ? ` à ${d.volumeCl} cl` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
