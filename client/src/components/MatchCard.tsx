// client/src/components/MatchCard.tsx
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { Match } from "../api/types";

export function MatchCard({ m }: { m: Match }) {
  return (
    <Card className="flex items-center justify-between">
      <div>
        <div className="font-display text-lg">{m.Spiller} <span className="text-ink/40">vs</span> {m.Modstander}</div>
        <div className="text-sm text-ink/60">{m.Dato} · {m.Arena} · {m.Point} point</div>
        {m.Drik_Navn && <div className="mt-1 text-sm text-bordeaux">🍷 {m.Drik_Navn}{m.Drik_Land ? ` (${m.Drik_Land})` : ""}</div>}
      </div>
      <div className="flex items-center gap-2">
        {m.Gruppe_Bool && <Badge tone="group">Gruppe</Badge>}
        <Badge tone={m.Vundet ? "win" : "loss"}>{m.Vundet ? "Vundet" : "Tabt"}</Badge>
        <Link to={`/matches/${m.id}/edit`} className="text-sm text-terracotta">Rediger</Link>
      </div>
    </Card>
  );
}
