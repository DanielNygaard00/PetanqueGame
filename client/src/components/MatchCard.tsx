// client/src/components/MatchCard.tsx
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { Match } from "../api/types";

export function MatchCard({ m }: { m: Match }) {
  const units = (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
  return (
    <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-display text-lg">{m.Spiller} <span className="text-ink/40">vs</span> {m.Modstander}</div>
        <div className="text-sm text-ink/60">
          {m.Dato}{m.Tid ? ` ${m.Tid}` : ""} · {m.Arena} · {m.Point ?? "–"}{typeof m.Modstander_Point === "number" ? `–${m.Modstander_Point}` : ""}
        </div>
        {units > 0 && <div className="mt-1 text-sm text-bordeaux">🍹 {units} drik{units === 1 ? "" : "ke"}</div>}
      </div>
      <div className="flex items-center gap-2">
        {m.Gruppe_Bool && <Badge tone="group">Gruppe</Badge>}
        <Badge tone={m.Vundet ? "win" : "loss"}>{m.Vundet ? "Vundet" : "Tabt"}</Badge>
        <Link to={`/matches/${m.id}/edit`} className="text-sm text-terracotta">Rediger</Link>
      </div>
    </Card>
  );
}
