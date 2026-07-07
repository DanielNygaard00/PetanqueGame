// client/src/pages/RivalryPage.tsx
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from "recharts";
import { useMatches } from "../api/hooks";
import { computeRivalry } from "../stats/rivalry";
import { computeElo } from "../stats/elo";
import { MatchCard } from "../components/MatchCard";
import { EloDeltaChip } from "../components/EloDeltaChip";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCards } from "../ui/Skeleton";

const fmtMargin = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}`;

export function RivalryPage() {
  const { a = "", b = "" } = useParams();
  const nameA = decodeURIComponent(a);
  const nameB = decodeURIComponent(b);
  const { data: matches = [], isLoading } = useMatches();
  const riv = useMemo(() => computeRivalry(matches, nameA, nameB), [matches, nameA, nameB]);
  const ratings = useMemo(() => computeElo(matches), [matches]);

  if (isLoading) return <SkeletonCards count={3} />;

  const title = `${nameA} mod ${nameB}`;
  if (riv.games === 0) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl">{title}</h2>
        <EmptyState emoji="🤝" title="Ingen indbyrdes kampe endnu" hint="Spil en kamp mod hinanden for at starte rivaliseringen." />
      </div>
    );
  }

  const eloA = ratings.find((r) => r.name === nameA)?.elo ?? 1000;
  const eloB = ratings.find((r) => r.name === nameB)?.elo ?? 1000;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="font-display text-4xl text-terracotta">{riv.aWins}–{riv.bWins}</p>
        <p className="text-sm text-ink/60">
          {riv.streak && (riv.streak.count > 1
            ? `${riv.streak.player} har vundet de sidste ${riv.streak.count}`
            : `${riv.streak.player} vandt seneste kamp`)}
          {" · "}gns. margin {fmtMargin(riv.avgMarginA)}
        </p>
      </div>

      <Card className="flex items-center justify-between">
        <div className="text-center">
          <div className="text-sm text-ink/60">{nameA}</div>
          <div className="font-display text-2xl text-terracotta">{eloA}</div>
        </div>
        <EloDeltaChip delta={eloA - eloB} suffix="Elo" />
        <div className="text-center">
          <div className="text-sm text-ink/60">{nameB}</div>
          <div className="font-display text-2xl text-terracotta">{eloB}</div>
        </div>
      </Card>

      {riv.series.length >= 2 && (
        <Card>
          <h3 className="mb-2 font-display text-lg">Udvikling</h3>
          <p className="mb-2 text-xs text-ink/50">Over nul: {nameA} fører · under nul: {nameB} fører</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={riv.series}>
              <XAxis dataKey="game" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine y={0} stroke="#8887" />
              <Line type="monotone" dataKey="diff" stroke="#C65D3B" dot />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="font-display text-lg">Indbyrdes kampe</h3>
        {riv.meetings.map((m) => <MatchCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}
