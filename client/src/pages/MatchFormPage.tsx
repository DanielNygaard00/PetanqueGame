// client/src/pages/MatchFormPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMatches, useCreateMatch, useUpdateMatch, useOptions, useAddOption } from "../api/hooks";
import { DrinkPicker } from "../components/DrinkPicker";
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { Match } from "../api/types";

export function MatchFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: matches = [] } = useMatches();
  const create = useCreateMatch();
  const update = useUpdateMatch();
  const players = useOptions("players");
  const arenas = useOptions("arenas");
  const drinkTypes = useOptions("drink_types");
  const drinkCategories = useOptions("drink_categories");
  const drinkBrands = useOptions("drink_brands");
  const drinkNames = useOptions("drink_names");
  const addArena = useAddOption("arenas");
  const addPlayer = useAddOption("players");

  const [form, setForm] = useState<Partial<Match>>({ Vundet: false, Gruppe_Bool: false });
  useEffect(() => {
    if (id) { const m = matches.find((x) => x.id === id); if (m) setForm(m); }
  }, [id, matches]);

  const set = (patch: Partial<Match>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (id) await update.mutateAsync({ id, ...form });
    else await create.mutateAsync(form);
    nav("/matches");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-3">
        <Input label="Dato" type="date" value={form.Dato ?? ""} onChange={(e) => set({ Dato: e.target.value })} />
        <SelectOrAdd label="Spiller" value={form.Spiller ?? ""} options={(players.data ?? []).map((o) => o.name)} onChange={(v) => set({ Spiller: v })} onAdd={(v) => addPlayer.mutate(v)} />
        <SelectOrAdd label="Arena" value={form.Arena ?? ""} options={(arenas.data ?? []).map((o) => o.name)} onChange={(v) => set({ Arena: v })} onAdd={(v) => addArena.mutate(v)} />
        <Input label="Modstander" value={form.Modstander ?? ""} onChange={(e) => set({ Modstander: e.target.value })} />
        <Input label="Point" type="number" value={form.Point ?? ""} onChange={(e) => set({ Point: Number(e.target.value) })} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.Vundet} onChange={(e) => set({ Vundet: e.target.checked })} /> Vundet</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.Gruppe_Bool} onChange={(e) => set({ Gruppe_Bool: e.target.checked })} /> Gruppespil</label>
        {form.Gruppe_Bool && <Input label="Gruppemedlemmer" value={form.Gruppe_medlemmer ?? ""} onChange={(e) => set({ Gruppe_medlemmer: e.target.value })} />}
        <Input label="Konsekutive spil" type="number" value={form["Konsekutive spil"] ?? ""} onChange={(e) => set({ "Konsekutive spil": Number(e.target.value) })} />
        <Input label="Spillets genstande" value={form["Spillets genstande"] ?? ""} onChange={(e) => set({ "Spillets genstande": e.target.value })} />
      </Card>
      <Card><DrinkPicker
          value={form}
          typeOptions={(drinkTypes.data ?? []).map((o) => o.name)}
          categoryOptions={(drinkCategories.data ?? []).map((o) => o.name)}
          brandOptions={(drinkBrands.data ?? []).map((o) => o.name)}
          nameOptions={(drinkNames.data ?? []).map((o) => o.name)}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        /></Card>
      <Button type="submit">{id ? "Gem ændringer" : "Log kamp"}</Button>
    </form>
  );
}
