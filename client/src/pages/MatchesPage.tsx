// client/src/pages/MatchesPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Download } from "lucide-react";
import { useMatches } from "../api/hooks";
import { computeEloWithHistory } from "../stats/elo";
import { MatchCard } from "../components/MatchCard";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { getToken } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { matchPerspective } from "../stats/perspective";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCards } from "../ui/Skeleton";

export function MatchesPage() {
  const { data = [], isLoading } = useMatches();
  const { user } = useAuth();
  const { deltas } = useMemo(() => computeEloWithHistory(data), [data]);
  const [q, setQ] = useState("");
  const [onlyWins, setOnlyWins] = useState(false);
  const filtered = data.filter((m) => {
    const names = (m.teams ?? []).flatMap((t) => t.players.map((p) => p.name));
    const hay = [m.Arena, ...names];
    const matchesQ = !q || hay.some((f) => f?.toLowerCase().includes(q.toLowerCase()));
    const won = user?.username ? matchPerspective(m, user.username)?.won === true : false;
    return matchesQ && (!onlyWins || won);
  });

  async function exportCsv() {
    const res = await fetch("/api/export", { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) { alert("Kunne ikke eksportere data"); return; }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url; a.download = "petanque_data.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Søg" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyWins} onChange={(e) => setOnlyWins(e.target.checked)} /> Kun sejre</label>
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <Link to="/live" className="flex-1 sm:flex-none"><Button variant="ghost" className="w-full"><span className="inline-flex items-center gap-1.5"><Play size={16} />Start live kamp</span></Button></Link>
          <Button variant="ghost" className="flex-1 sm:flex-none" onClick={exportCsv}><span className="inline-flex items-center gap-1.5"><Download size={16} />Eksportér CSV</span></Button>
        </div>
      </div>
      {isLoading ? (
        <SkeletonCards count={4} />
      ) : data.length === 0 ? (
        <EmptyState emoji="🎯" title="Ingen kampe endnu" hint="Grib kuglerne og log jeres første kamp." cta={{ label: "Log kamp", to: "/matches/new" }} />
      ) : filtered.length === 0 ? (
        <EmptyState emoji="🔍" title="Ingen kampe matcher" hint="Prøv en anden søgning." />
      ) : (
        <div className="space-y-3">{filtered.map((m) => (
          <MatchCard key={m.id} m={m} eloDelta={user?.username ? deltas.get(m.id)?.get(user.username) : undefined} />
        ))}</div>
      )}
    </div>
  );
}
