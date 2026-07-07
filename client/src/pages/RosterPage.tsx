// client/src/pages/RosterPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import { usePlayers, useRenamePlayer, useMergePlayers } from "../api/hooks";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SkeletonCards } from "../ui/Skeleton";

export function RosterPage() {
  const { data = [], isLoading } = usePlayers();
  const rename = useRenamePlayer();
  const merge = useMergePlayers();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mergeSrc, setMergeSrc] = useState("");
  const [mergeInto, setMergeInto] = useState("");

  if (isLoading) return <SkeletonCards count={4} />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Spillere</h2>
        <Link to="/options"><Button variant="ghost"><span className="inline-flex items-center gap-1.5"><Settings size={16} />Indstillinger</span></Button></Link>
      </div>

      <Card>
        <ul className="divide-y divide-ink/10">
          {data.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              {editing === p.id ? (
                <div className="flex flex-wrap items-center gap-2 w-full">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full sm:w-48" />
                  <Button onClick={() => { rename.mutate({ id: p.id, name: draft }); setEditing(null); }}>Gem</Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>Annullér</Button>
                </div>
              ) : (
                <>
                  <span>{p.name} <span className="text-ink/40">· {p.games} kampe</span></span>
                  <Button variant="ghost" onClick={() => { setEditing(p.id); setDraft(p.name); }}>Omdøb</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <h3 className="font-display text-lg">Flet spillere</h3>
        <p className="text-sm text-ink/60">Flet en dublet ind i den rigtige spiller (kampe flyttes med).</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm w-full sm:w-auto">Flet<br/>
            <select className="w-full sm:w-auto rounded-card border border-ink/15 bg-cream px-2 py-1" value={mergeSrc} onChange={(e) => setMergeSrc(e.target.value)}>
              <option value="">—</option>{data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm w-full sm:w-auto">ind i<br/>
            <select className="w-full sm:w-auto rounded-card border border-ink/15 bg-cream px-2 py-1" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              <option value="">—</option>{data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Button
            className="w-full sm:w-auto"
            disabled={!mergeSrc || !mergeInto || mergeSrc === mergeInto}
            onClick={() => { if (confirm("Flet spillere? Dette kan ikke fortrydes.")) { merge.mutate({ id: mergeSrc, intoId: mergeInto }); setMergeSrc(""); setMergeInto(""); } }}
          >Flet</Button>
        </div>
      </Card>
    </div>
  );
}
