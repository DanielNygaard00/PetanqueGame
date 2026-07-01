// client/src/components/DrinkPicker.tsx
import { SelectOrAdd } from "../ui/SelectOrAdd";
import { Input } from "../ui/Input";
import type { Match } from "../api/types";

type Props = {
  value: Partial<Match>;
  typeOptions: string[];
  categoryOptions?: string[];
  brandOptions?: string[];
  nameOptions?: string[];
  onChange: (patch: Partial<Match>) => void;
};

export function DrinkPicker({ value, typeOptions, categoryOptions = [], brandOptions = [], nameOptions = [], onChange }: Props) {
  const set = (patch: Partial<Match>) => onChange(patch);
  const isWine = value.Drik_Type === "Vin";
  return (
    <div className="space-y-3">
      <SelectOrAdd label="Drik type" value={value.Drik_Type ?? ""} options={typeOptions} onChange={(v) => set({ Drik_Type: v })} />
      <SelectOrAdd label="Kategori" value={value.Drik_Kategori ?? ""} options={categoryOptions} onChange={(v) => set({ Drik_Kategori: v })} />
      <SelectOrAdd label="Brand" value={value.Drik_Brand ?? ""} options={brandOptions} onChange={(v) => set({ Drik_Brand: v })} />
      <SelectOrAdd label="Navn" value={value.Drik_Navn ?? ""} options={nameOptions} onChange={(v) => set({ Drik_Navn: v })} />
      {isWine && (
        <Input label="Region" value={value.Vin_Region ?? ""} onChange={(e) => set({ Vin_Region: e.target.value })} />
      )}
    </div>
  );
}
