// client/src/pages/MatchFormPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMatches, useCreateMatch, useUpdateMatch, useOptions, useAddOption, usePlayers, useAddPlayer } from "../api/hooks";
import { DrinksEditor } from "../components/DrinksEditor";
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import type { Match, Drink } from "../api/types";

export function MatchFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: matches = [] } = useMatches();
  const create = useCreateMatch();
  const update = useUpdateMatch();
  const players = usePlayers();
  const addPlayer = useAddPlayer();
  const playerNames = (players.data ?? []).map((p) => p.name);
  const arenas = useOptions("arenas");
  const drinkTypes = useOptions("drink_types");
  const drinkCategories = useOptions("drink_categories");
  const drinkBrands = useOptions("drink_brands");
  const drinkNames = useOptions("drink_names");
  const addArena = useAddOption("arenas");
  const addDrinkType = useAddOption("drink_types");
  const addDrinkCategory = useAddOption("drink_categories");
  const addDrinkBrand = useAddOption("drink_brands");
  const addDrinkName = useAddOption("drink_names");

  const [form, setForm] = useState<Partial<Match>>({ Vundet: false, Gruppe_Bool: false, drinks: [] as Drink[] });
  const [error, setError] = useState<string | null>(null);

  const last = matches[0];

  useEffect(() => {
    if (id) { const m = matches.find((x) => x.id === id); if (m) setForm(m); }
  }, [id, matches]);

  useEffect(() => {
    if (id) return; // edit mode handled elsewhere
    const nowHM = new Date().toTimeString().slice(0, 5);
    const today = new Date().toISOString().slice(0, 10);
    setForm((f) => ({
      ...f,
      Dato: f.Dato ?? today,
      Tid: f.Tid ?? nowHM,
      Spiller: f.Spiller ?? last?.Spiller,
      Arena: f.Arena ?? last?.Arena,
    }));
    // run once when matches first arrive
  }, [id, matches.length]);

  const set = (patch: Partial<Match>) => setForm((f) => ({ ...f, ...patch }));

  function validate(): string | null {
    if (!form.Dato) return "Dato er påkrævet";
    if (!form.Spiller) return "Spiller er påkrævet";
    for (const k of ["Point", "Modstander_Point"] as const) {
      const v = form[k];
      if (v != null && (v < 0 || v > 50)) return "Point skal være mellem 0 og 50";
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    if (id) await update.mutateAsync({ id, ...form });
    else await create.mutateAsync(form);
    nav("/matches");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Card className="space-y-3">
        <Input label="Dato" type="date" value={form.Dato ?? ""} onChange={(e) => set({ Dato: e.target.value })} />
        <Input label="Tid" type="time" value={form.Tid ?? ""} onChange={(e) => set({ Tid: e.target.value })} />
        <SelectOrAdd label="Spiller" value={form.Spiller ?? ""} options={playerNames} onChange={(v) => set({ Spiller: v })} onAdd={(v) => addPlayer.mutate(v)} />
        <SelectOrAdd label="Arena" value={form.Arena ?? ""} options={(arenas.data ?? []).map((o) => o.name)} onChange={(v) => set({ Arena: v })} onAdd={(v) => addArena.mutate(v)} />
        <SelectOrAdd label="Modstander" value={form.Modstander ?? ""} options={playerNames} onChange={(v) => set({ Modstander: v })} onAdd={(v) => addPlayer.mutate(v)} />
        <Input label="Point" type="number" value={form.Point ?? ""} onChange={(e) => set({ Point: e.target.value === "" ? undefined : Number(e.target.value) })} />
        <Input label="Modstander point" type="number" value={form.Modstander_Point ?? ""} onChange={(e) => set({ Modstander_Point: e.target.value === "" ? undefined : Number(e.target.value) })} />
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.Vundet} onChange={(e) => set({ Vundet: e.target.checked })} /> Vundet</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.Gruppe_Bool} onChange={(e) => set({ Gruppe_Bool: e.target.checked })} /> Gruppespil</label>
        {form.Gruppe_Bool && <Input label="Gruppemedlemmer" value={form.Gruppe_medlemmer ?? ""} onChange={(e) => set({ Gruppe_medlemmer: e.target.value })} />}
        <Input label="Konsekutive spil" type="number" value={form["Konsekutive spil"] ?? ""} onChange={(e) => set({ "Konsekutive spil": e.target.value === "" ? undefined : Number(e.target.value) })} />
        <Input label="Spillets genstande" value={form["Spillets genstande"] ?? ""} onChange={(e) => set({ "Spillets genstande": e.target.value })} />
      </Card>
      <Card>
        <h3 className="mb-2 font-display text-lg">Drikkevarer i denne omgang</h3>
        <DrinksEditor
          value={form.drinks ?? []}
          onChange={(drinks) => set({ drinks })}
          typeOptions={(drinkTypes.data ?? []).map((o) => o.name)}
          categoryOptions={(drinkCategories.data ?? []).map((o) => o.name)}
          brandOptions={(drinkBrands.data ?? []).map((o) => o.name)}
          nameOptions={(drinkNames.data ?? []).map((o) => o.name)}
          onAddType={(v) => addDrinkType.mutate(v)}
          onAddCategory={(v) => addDrinkCategory.mutate(v)}
          onAddBrand={(v) => addDrinkBrand.mutate(v)}
          onAddName={(v) => addDrinkName.mutate(v)}
        />
      </Card>
      {!id && last?.drinks?.length ? (
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => set({ drinks: last.drinks })}>
          Gentag sidste omgang ({last.drinks.length} drikke)
        </Button>
      ) : null}
      <Button type="submit">{id ? "Gem ændringer" : "Log kamp"}</Button>
    </form>
  );
}
