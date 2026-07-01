// client/src/ui/SelectOrAdd.tsx
import { useState } from "react";
import { Input } from "./Input";
import { Button } from "./Button";

type Props = {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onAdd?: (v: string) => void;
};

export function SelectOrAdd({ label, value, options, onChange, onAdd }: Props) {
  const [query, setQuery] = useState(value);
  const trimmed = query.trim();
  const matches = trimmed
    ? options.filter((o) => o.toLowerCase().includes(trimmed.toLowerCase()))
    : options;
  const isNew = trimmed.length > 0 && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="space-y-2">
      <Input
        label={label}
        value={query}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); }}
      />
      <div className="flex flex-wrap gap-1.5">
        {matches.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => { setQuery(o); onChange(o); }}
            className={`rounded-full border px-2.5 py-0.5 text-sm ${o === value ? "border-terracotta bg-terracotta/10" : "border-ink/15 hover:bg-ink/5"}`}
          >
            {o}
          </button>
        ))}
      </div>
      {isNew && onAdd && (
        <Button variant="ghost" type="button" onClick={() => { onAdd(trimmed); onChange(trimmed); }}>
          Tilføj "{trimmed}"
        </Button>
      )}
    </div>
  );
}
