// client/src/pages/MatchFormPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMatches, useCreateMatch, useUpdateMatch, useOptions, useAddOption, usePlayers, useAddPlayer } from "../api/hooks";
import { ymd } from "../stats/dateRange";
import { DrinksEditor } from "../components/DrinksEditor";
import { TeamsEditor, type TeamInput } from "../components/TeamsEditor";
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useAuth } from "../auth/AuthContext";
import { useFormDraft } from "../hooks/useFormDraft";
import type { Match, Drink } from "../api/types";

type FormState = {
  Dato?: string; Tid?: string; Arena?: string; "Spillets genstande"?: string;
  teams: TeamInput[]; drinks: Drink[];
};

export const MATCH_DRAFT_KEY = "matchFormDraft:v1";

export function formHasSubstance(f: FormState): boolean {
  if (f.drinks.length > 0) return true;
  if (f["Spillets genstande"]) return true;
  if (f.teams.some((t) => t.score != null)) return true;
  if ((f.teams[0]?.players.length ?? 0) > 1) return true;
  return f.teams.slice(1).some((t) => t.players.length > 0);
}

function toFormState(m: Match): FormState {
  return {
    Dato: m.Dato, Tid: m.Tid, Arena: m.Arena, "Spillets genstande": m["Spillets genstande"],
    teams: (m.teams ?? []).map((t) => ({ score: t.score, players: t.players.map((p) => p.name) })),
    drinks: m.drinks ?? [],
  };
}

export function MatchFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
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

  const [form, setForm] = useState<FormState>({ teams: [{ score: null, players: [] }, { score: null, players: [] }], drinks: [] });
  const [error, setError] = useState<string | null>(null);
  const draft = useFormDraft<FormState>(MATCH_DRAFT_KEY, form, setForm, {
    enabled: !id,
    hasSubstance: formHasSubstance,
  });
  const last = matches[0];

  useEffect(() => {
    if (id) { const m = matches.find((x) => x.id === id); if (m) setForm(toFormState(m)); }
  }, [id, matches]);

  useEffect(() => {
    if (id) return;
    const nowHM = new Date().toTimeString().slice(0, 5);
    const today = ymd(new Date());
    setForm((f) => ({
      ...f,
      Dato: f.Dato ?? today,
      Tid: f.Tid ?? nowHM,
      Arena: f.Arena ?? last?.Arena,
      teams: f.teams[0].players.length === 0 && user?.username
        ? [{ score: null, players: [user.username] }, { score: null, players: [] }]
        : f.teams,
    }));
  }, [id, matches.length, user?.username]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const participantNames = form.teams.flatMap((t) => t.players);

  function discardDraft() {
    draft.clear();
    setForm({
      Dato: ymd(new Date()),
      Tid: new Date().toTimeString().slice(0, 5),
      Arena: last?.Arena,
      teams: [{ score: null, players: user?.username ? [user.username] : [] }, { score: null, players: [] }],
      drinks: [],
    });
  }

  function validate(): string | null {
    if (!form.Dato) return "Dato er påkrævet";
    if (form.teams.length < 2) return "Der skal være mindst to hold";
    if (form.teams.some((t) => t.players.length === 0)) return "Hvert hold skal have mindst én spiller";
    for (const t of form.teams) if (t.score != null && (t.score < 0 || t.score > 50)) return "Point skal være mellem 0 og 50";
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    const payload = {
      Dato: form.Dato, Tid: form.Tid, Arena: form.Arena, "Spillets genstande": form["Spillets genstande"],
      teams: form.teams, drinks: form.drinks,
    };
    if (id) await update.mutateAsync({ id, ...payload });
    else { await create.mutateAsync(payload); draft.clear(); }
    nav("/matches");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {draft.restored && (
        <p className="text-sm text-ink/60">
          Kladde gendannet · <button type="button" className="text-terracotta underline" onClick={discardDraft}>Ryd</button>
        </p>
      )}
      <Card className="space-y-3">
        <Input label="Dato" type="date" value={form.Dato ?? ""} onChange={(e) => set({ Dato: e.target.value })} />
        <Input label="Tid" type="time" value={form.Tid ?? ""} onChange={(e) => set({ Tid: e.target.value })} />
        <SelectOrAdd label="Arena" value={form.Arena ?? ""} options={(arenas.data ?? []).map((o) => o.name)} onChange={(v) => set({ Arena: v })} onAdd={(v) => addArena.mutate(v)} />
        <Input label="Spillets genstande" value={form["Spillets genstande"] ?? ""} onChange={(e) => set({ "Spillets genstande": e.target.value })} />
      </Card>
      <Card className="space-y-3">
        <h3 className="font-display text-lg">Hold</h3>
        <TeamsEditor value={form.teams} onChange={(teams) => set({ teams })} playerOptions={playerNames} onAddPlayer={(v) => addPlayer.mutate(v)} />
      </Card>
      <Card>
        <h3 className="mb-2 font-display text-lg">Drikkevarer i denne omgang</h3>
        <DrinksEditor
          value={form.drinks}
          onChange={(drinks) => set({ drinks })}
          typeOptions={(drinkTypes.data ?? []).map((o) => o.name)}
          categoryOptions={(drinkCategories.data ?? []).map((o) => o.name)}
          brandOptions={(drinkBrands.data ?? []).map((o) => o.name)}
          nameOptions={(drinkNames.data ?? []).map((o) => o.name)}
          playerOptions={participantNames}
          onAddType={(v) => addDrinkType.mutate(v)}
          onAddCategory={(v) => addDrinkCategory.mutate(v)}
          onAddBrand={(v) => addDrinkBrand.mutate(v)}
          onAddName={(v) => addDrinkName.mutate(v)}
        />
      </Card>
      {!id && last?.drinks?.length ? (
        <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => set({ drinks: last.drinks ?? [] })}>
          Gentag sidste omgang ({last.drinks.length} drikke)
        </Button>
      ) : null}
      <Button type="submit">{id ? "Gem ændringer" : "Log kamp"}</Button>
    </form>
  );
}
