// client/src/components/DrinksEditor.tsx
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import type { Drink } from "../api/types";

type Props = {
  value: Drink[];
  onChange: (drinks: Drink[]) => void;
  typeOptions: string[];
  categoryOptions?: string[];
  brandOptions?: string[];
  nameOptions?: string[];
  onAddType?: (v: string) => void;
  onAddCategory?: (v: string) => void;
  onAddBrand?: (v: string) => void;
  onAddName?: (v: string) => void;
};

export function DrinksEditor({ value, onChange, typeOptions, categoryOptions = [], brandOptions = [], nameOptions = [], onAddType, onAddCategory, onAddBrand, onAddName }: Props) {
  const update = (i: number, patch: Partial<Drink>) =>
    onChange(value.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const add = () => onChange([...value, { count: 1 }]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      {value.map((d, i) => (
        <div key={i} className="rounded-card border border-ink/10 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink/70">Drik {i + 1}</span>
            <Button type="button" variant="ghost" onClick={() => remove(i)}>Fjern</Button>
          </div>
          <SelectOrAdd label="Type" value={d.type ?? ""} options={typeOptions} onChange={(v) => update(i, v === "Vin" ? { type: v } : { type: v, wineRegion: undefined })} onAdd={onAddType} />
          <SelectOrAdd label="Kategori" value={d.category ?? ""} options={categoryOptions} onChange={(v) => update(i, { category: v })} onAdd={onAddCategory} />
          <SelectOrAdd label="Brand" value={d.brand ?? ""} options={brandOptions} onChange={(v) => update(i, { brand: v })} onAdd={onAddBrand} />
          <SelectOrAdd label="Navn" value={d.name ?? ""} options={nameOptions} onChange={(v) => update(i, { name: v })} onAdd={onAddName} />
          {d.type === "Vin" && (
            <Input label="Region" value={d.wineRegion ?? ""} onChange={(e) => update(i, { wineRegion: e.target.value })} />
          )}
          <div className="flex gap-3">
            <Input label="Antal" type="number" min={1} value={d.count ?? 1} onChange={(e) => update(i, { count: Number(e.target.value) })} className="w-24" />
            <Input label="Volumen (cl)" type="number" value={d.volumeCl ?? ""} onChange={(e) => update(i, { volumeCl: e.target.value === "" ? null : Number(e.target.value) })} className="w-32" />
          </div>
        </div>
      ))}
      <Button type="button" variant="ghost" onClick={add}>+ Tilføj drik</Button>
    </div>
  );
}
