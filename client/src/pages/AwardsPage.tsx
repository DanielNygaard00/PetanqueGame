// client/src/pages/AwardsPage.tsx
import { useMemo, useState } from "react";
import { useMatches } from "../api/hooks";
import { filterByPeriod, computeAwards, type AwardPeriod } from "../stats/awards";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCards } from "../ui/Skeleton";

const PERIODS: { key: AwardPeriod; label: string }[] = [
  { key: "month", label: "Måned" },
  { key: "year", label: "År" },
  { key: "all", label: "Altid" },
];

export function AwardsPage() {
  const { data = [], isLoading } = useMatches();
  const [period, setPeriod] = useState<AwardPeriod>("month");
  const awards = useMemo(
    () => computeAwards(filterByPeriod(data, period, new Date()), data),
    [data, period],
  );

  if (isLoading) return <SkeletonCards count={4} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl">Priser</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <Button key={p.key} type="button" variant={period === p.key ? undefined : "ghost"} onClick={() => setPeriod(p.key)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>
      {awards.length === 0 ? (
        <EmptyState emoji="🏆" title="Ikke nok kampe i perioden endnu" hint="Der skal mindst 3 kampe til en pris." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {awards.map((a) => (
            <Card key={a.key} className="flex flex-col items-center gap-1 py-6 text-center">
              <span className="text-4xl">{a.emoji}</span>
              <h3 className="text-sm text-ink/60">{a.title}</h3>
              <span className="font-display text-xl text-terracotta">{a.winner}</span>
              <span className="text-sm text-ink/60">{a.detail}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
