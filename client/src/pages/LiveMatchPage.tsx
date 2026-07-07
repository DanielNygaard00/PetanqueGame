// client/src/pages/LiveMatchPage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateMatch, useMatches, useOptions, useAddOption, usePlayers } from "../api/hooks";
import { useFormDraft } from "../hooks/useFormDraft";
import { ymd } from "../stats/dateRange";
import {
  initialLiveState, validateSetup, startMatch, scoreEnd, undoEnd,
  finishMatch, winnerIndex, toMatchInput, type LiveState,
} from "../live/liveMatch";
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export const LIVE_KEY = "liveMatch:v1";

const localNow = () => `${ymd(new Date())}T${new Date().toTimeString().slice(0, 5)}`;

export function LiveMatchPage() {
  const nav = useNavigate();
  const [state, setState] = useState<LiveState>(initialLiveState());
  const [error, setError] = useState<string | null>(null);
  const [pickTeam, setPickTeam] = useState<0 | 1 | null>(null);
  const draft = useFormDraft<LiveState>(LIVE_KEY, state, setState, {
    enabled: true,
    hasSubstance: (s) => s.status !== "setup",
  });
  const create = useCreateMatch();
  const { data: matches = [] } = useMatches();
  const players = usePlayers();
  const arenas = useOptions("arenas");
  const addArena = useAddOption("arenas");
  const playerNames = (players.data ?? []).map((p) => p.name);

  // Keep the screen awake while a match is running (best-effort).
  useEffect(() => {
    if (state.status !== "playing") return;
    let lock: { release: () => Promise<void> } | undefined;
    let cancelled = false;
    (async () => {
      try {
        lock = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen");
        if (cancelled) await lock?.release();
      } catch { /* unsupported or denied — play on */ }
    })();
    return () => { cancelled = true; lock?.release().catch(() => {}); };
  }, [state.status]);

  const setTeamPlayers = (i: 0 | 1, names: string[]) =>
    setState((s) => {
      const teams = [...s.teams] as LiveState["teams"];
      teams[i] = { ...teams[i], players: names };
      return { ...s, teams };
    });

  function start() {
    const err = validateSetup(state);
    if (err) { setError(err); return; }
    setError(null);
    setState((s) => startMatch({ ...s, arena: s.arena ?? matches[0]?.Arena }, localNow()));
  }

  function tapScore(team: 0 | 1, points: number) {
    setPickTeam(null);
    setState((s) => scoreEnd(s, team, points));
  }

  function endEarly() {
    if (state.teams[0].points === state.teams[1].points) {
      setError("Uafgjort — spil en runde mere eller fortryd");
      return;
    }
    setError(null);
    setState(finishMatch);
  }

  async function save() {
    try {
      const saved = await create.mutateAsync(toMatchInput(state));
      draft.clear();
      nav(`/matches/${saved.id}/edit`);
    } catch {
      setError("Kunne ikke gemme kampen — prøv igen");
    }
  }

  function discard() {
    draft.clear();
    setState(initialLiveState());
    setError(null);
  }

  if (state.status === "setup") {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-2xl">Live kamp</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {([0, 1] as const).map((i) => (
          <Card key={i} className="space-y-2">
            <h3 className="text-sm font-medium text-ink/70">Hold {i + 1}</h3>
            <div className="flex flex-wrap gap-1.5">
              {state.teams[i].players.map((p) => (
                <button key={p} type="button" onClick={() => setTeamPlayers(i, state.teams[i].players.filter((x) => x !== p))}
                  className="rounded-full border border-terracotta bg-terracotta/10 px-2.5 py-0.5 text-sm">
                  {p} ✕
                </button>
              ))}
              {state.teams[i].players.length === 0 && <span className="text-sm text-ink/40">Ingen spillere valgt</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {playerNames.filter((p) => !state.teams[i].players.includes(p)).map((p) => (
                <button key={p} type="button" onClick={() => setTeamPlayers(i, [...state.teams[i].players, p])}
                  className="rounded-full border border-ink/15 px-2.5 py-0.5 text-sm hover:bg-ink/5">
                  + {p}
                </button>
              ))}
            </div>
          </Card>
        ))}
        <Card className="space-y-3">
          <SelectOrAdd label="Arena" value={state.arena ?? matches[0]?.Arena ?? ""} options={(arenas.data ?? []).map((o) => o.name)}
            onChange={(v) => setState((s) => ({ ...s, arena: v }))} onAdd={(v) => addArena.mutate(v)} />
          <Input label="Målscore" type="number" value={state.target}
            onChange={(e) => setState((s) => ({ ...s, target: Number(e.target.value) || 0 }))} className="w-full sm:w-32" />
          <p className="text-xs text-ink/50">Nye spillere tilføjes på Spillere-siden eller i kampformularen.</p>
        </Card>
        <Button type="button" className="w-full" onClick={start}>Start kamp</Button>
      </div>
    );
  }

  const win = winnerIndex(state);

  return (
    <div className="space-y-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {state.status === "finished" && win != null && (
        <Card className="border-olive bg-olive/5 text-center">
          <p className="font-display text-xl">
            {state.teams[win].players.join(" + ")} vinder {state.teams[win].points}–{state.teams[1 - win].points} · {state.ends.length} runde{state.ends.length === 1 ? "" : "r"}
          </p>
        </Card>
      )}
      <div className="grid grid-cols-2 gap-3">
        {([0, 1] as const).map((i) => (
          <button key={i} type="button" disabled={state.status !== "playing"}
            onClick={() => setPickTeam(pickTeam === i ? null : i)}
            className={`rounded-card border p-4 text-center ${win === i ? "border-olive bg-olive/5" : "border-ink/10 bg-white"}`}>
            <div className="truncate text-sm text-ink/70">{state.teams[i].players.join(" + ")}</div>
            <div className="font-display text-6xl text-terracotta">{state.teams[i].points}</div>
          </button>
        ))}
      </div>
      {pickTeam != null && state.status === "playing" && (
        <Card className="flex flex-wrap justify-center gap-2">
          {[1, 2, 3, 4, 5, 6].map((p) => (
            <button key={p} type="button" onClick={() => tapScore(pickTeam, p)}
              className="h-12 w-12 rounded-full border border-terracotta font-display text-lg text-terracotta hover:bg-terracotta/10">
              +{p}
            </button>
          ))}
        </Card>
      )}
      {state.ends.length > 0 && (
        <Card className="space-y-1 text-sm text-ink/60">
          {state.ends.map((e, i) => (
            <div key={i}>Runde {i + 1} · Hold {e.team + 1} +{e.points}</div>
          ))}
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        {state.status === "playing" ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setState(undoEnd)} disabled={state.ends.length === 0}>Fortryd</Button>
            <Button type="button" variant="ghost" onClick={endEarly}>Afslut</Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={save} disabled={create.isPending}>Gem kamp</Button>
            <Button type="button" variant="ghost" onClick={() => setState(undoEnd)}>Fortsæt</Button>
            <Button type="button" variant="ghost" onClick={() => { if (confirm("Sikker på at kassere kampen?")) discard(); }}>Kassér</Button>
          </>
        )}
      </div>
    </div>
  );
}
