// client/src/components/MatchCard.tsx
import { Link } from "react-router-dom";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EloDeltaChip } from "./EloDeltaChip";
import { isGroup } from "../stats/perspective";
import type { Match, Team } from "../api/types";

const teamLabel = (t: Team) => t.players.map((p) => p.name).join(" + ");

export function MatchCard({ m, eloDelta }: { m: Match; eloDelta?: number }) {
  const units = (m.drinks ?? []).reduce((s, d) => s + (d.count ?? 0), 0);
  const teams = m.teams ?? [];
  return (
    <Link to={`/matches/${m.id}`} className="block">
      <Card className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-lg">
            {teams.map((t, i) => (
              <span key={t.team}>
                {i > 0 && <span className="text-ink/40"> vs </span>}
                <span className={t.won ? "text-olive" : undefined}>
                  {teamLabel(t)}{t.score != null ? ` (${t.score})` : ""}
                </span>
              </span>
            ))}
          </div>
          <div className="text-sm text-ink/60">
            {m.Dato}{m.Tid ? ` ${m.Tid}` : ""}{m.Arena ? ` · ${m.Arena}` : ""}
          </div>
          {units > 0 && <div className="mt-1 text-sm text-bordeaux">🍹 {units} drik{units === 1 ? "" : "ke"}</div>}
        </div>
        <div className="flex items-center gap-2">
          {eloDelta !== undefined && <EloDeltaChip delta={eloDelta} />}
          {isGroup(m) && <Badge tone="group">Gruppe</Badge>}
        </div>
      </Card>
    </Link>
  );
}
