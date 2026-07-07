// client/src/pages/OptionsPage.tsx
import { useState } from "react";
import { useOptions, useRenameOption, useDeleteOption } from "../api/hooks";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SkeletonCards } from "../ui/Skeleton";

const COLLECTIONS = [
  { key: "arenas", label: "Arenaer" },
  { key: "drink_types", label: "Drikketyper" },
  { key: "drink_categories", label: "Kategorier" },
  { key: "drink_brands", label: "Mærker" },
  { key: "drink_names", label: "Navne" },
];

function CollectionSection({ collection, label }: { collection: string; label: string }) {
  const { data, isLoading } = useOptions(collection);
  const rename = useRenameOption(collection);
  const del = useDeleteOption(collection);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (isLoading) return <SkeletonCards count={1} />;
  const items = data ?? [];
  return (
    <Card>
      <h3 className="mb-2 font-display text-lg">{label}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink/40">Ingen endnu</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {items.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 py-2">
              {editing === o.id ? (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full sm:w-48" />
                  <Button onClick={() => { rename.mutate({ id: o.id, name: draft }); setEditing(null); }}>Gem</Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>Annullér</Button>
                </div>
              ) : (
                <>
                  <span>
                    {o.name}{" "}
                    <span className="text-ink/40">· {o.uses ? `bruges i ${o.uses} kampe` : "bruges ikke"}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    <Button variant="ghost" onClick={() => { setEditing(o.id); setDraft(o.name); }}>Rediger</Button>
                    <Button variant="ghost" onClick={() => {
                      if (confirm(`Slet "${o.name}"? Bruges i ${o.uses ?? 0} kampe — kampene beholder teksten.`)) del.mutate(o.id);
                    }}>Slet</Button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function OptionsPage() {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">Indstillinger</h2>
      {COLLECTIONS.map((c) => <CollectionSection key={c.key} collection={c.key} label={c.label} />)}
    </div>
  );
}
