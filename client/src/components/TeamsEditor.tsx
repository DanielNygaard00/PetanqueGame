// client/src/components/TeamsEditor.tsx
import { useState } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export type TeamInput = { score: number | null; players: string[] };

type Props = {
  value: TeamInput[];
  onChange: (teams: TeamInput[]) => void;
  playerOptions: string[];
  onAddPlayer?: (v: string) => void;
};

export function TeamsEditor({ value, onChange, playerOptions, onAddPlayer }: Props) {
  const [newName, setNewName] = useState<string[]>(value.map(() => ""));
  const scores = value.map((t) => t.score).filter((s): s is number => typeof s === "number");
  const max = scores.length ? Math.max(...scores) : null;
  const setTeam = (i: number, patch: Partial<TeamInput>) => onChange(value.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTeam = () => { onChange([...value, { score: null, players: [] }]); setNewName([...newName, ""]); };
  const removeTeam = (i: number) => { onChange(value.filter((_, idx) => idx !== i)); setNewName(newName.filter((_, idx) => idx !== i)); };
  const addPlayer = (i: number, name: string) => {
    const n = name.trim();
    if (!n || value[i].players.includes(n)) return;
    setTeam(i, { players: [...value[i].players, n] });
  };
  const removePlayer = (i: number, name: string) => setTeam(i, { players: value[i].players.filter((p) => p !== name) });
  const setName = (i: number, v: string) => setNewName(newName.map((x, idx) => (idx === i ? v : x)));
  const commitNew = (i: number) => {
    const n = (newName[i] ?? "").trim();
    if (!n) return;
    if (!playerOptions.some((p) => p.toLowerCase() === n.toLowerCase())) onAddPlayer?.(n);
    addPlayer(i, n);
    setName(i, "");
  };

  return (
    <div className="space-y-4">
      {value.map((t, i) => {
        const isWinner = t.score != null && max != null && t.score === max;
        const available = playerOptions.filter((p) => !t.players.includes(p));
        return (
          <div key={i} className={`rounded-card border p-3 space-y-2 ${isWinner ? "border-olive bg-olive/5" : "border-ink/10"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">Hold {i + 1}{isWinner ? " 🏆" : ""}</span>
              {value.length > 2 && <Button type="button" variant="ghost" onClick={() => removeTeam(i)}>Fjern hold</Button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.players.map((p) => (
                <button key={p} type="button" onClick={() => removePlayer(i, p)}
                  className="rounded-full border border-terracotta bg-terracotta/10 px-2.5 py-0.5 text-sm">
                  {p} ✕
                </button>
              ))}
              {t.players.length === 0 && <span className="text-sm text-ink/40">Ingen spillere valgt</span>}
            </div>
            {available.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {available.map((p) => (
                  <button key={p} type="button" onClick={() => addPlayer(i, p)}
                    className="rounded-full border border-ink/15 px-2.5 py-0.5 text-sm hover:bg-ink/5">
                    + {p}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <Input label="Ny spiller" value={newName[i] ?? ""} onChange={(e) => setName(i, e.target.value)} className="w-full sm:w-40" />
              <Button type="button" variant="ghost" onClick={() => commitNew(i)}>Tilføj spiller</Button>
            </div>
            <Input label="Point" type="number" value={t.score ?? ""}
              onChange={(e) => setTeam(i, { score: e.target.value === "" ? null : Number(e.target.value) })}
              className="w-full sm:w-32" />
          </div>
        );
      })}
      <Button type="button" variant="ghost" onClick={addTeam}>+ Tilføj hold</Button>
    </div>
  );
}
