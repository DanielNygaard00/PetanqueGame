// client/src/pages/MatchesPage.tsx
import { useState } from "react";
import { useMatches } from "../api/hooks";
import { MatchCard } from "../components/MatchCard";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { getToken } from "../api/client";

export function MatchesPage() {
  const { data = [], isLoading } = useMatches();
  const [q, setQ] = useState("");
  const [onlyWins, setOnlyWins] = useState(false);
  const filtered = data.filter((m) =>
    (!q || [m.Spiller, m.Arena, m.Modstander].some((f) => f?.toLowerCase().includes(q.toLowerCase()))) &&
    (!onlyWins || m.Vundet));

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
        <Input label="Søg" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyWins} onChange={(e) => setOnlyWins(e.target.checked)} /> Kun sejre</label>
        <div className="ml-auto"><Button variant="ghost" onClick={exportCsv}>Eksportér CSV</Button></div>
      </div>
      {isLoading ? <p>Henter…</p> : <div className="space-y-3">{filtered.map((m) => <MatchCard key={m.id} m={m} />)}</div>}
    </div>
  );
}
