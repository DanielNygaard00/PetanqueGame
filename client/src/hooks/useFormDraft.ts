// client/src/hooks/useFormDraft.ts
import { useEffect, useRef, useState } from "react";

export function useFormDraft<T>(
  key: string,
  form: T,
  setForm: (f: T) => void,
  opts: { enabled: boolean; hasSubstance: (f: T) => boolean; debounceMs?: number },
) {
  const [restored, setRestored] = useState(false);
  const didRestore = useRef(false);
  // Skip the save that would fire from the restore itself / the initial render.
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (!opts.enabled || didRestore.current) return;
    didRestore.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        setForm(JSON.parse(raw) as T);
        setRestored(true);
      }
    } catch {
      // Best-effort: malformed JSON or unavailable storage means no draft.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.enabled]);

  useEffect(() => {
    if (!opts.enabled) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const t = setTimeout(() => {
      try {
        if (opts.hasSubstance(form)) localStorage.setItem(key, JSON.stringify(form));
      } catch {
        // Best-effort: quota/unavailable storage is not an error for the user.
      }
    }, opts.debounceMs ?? 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, form, opts.enabled]);

  const clear = () => {
    try { localStorage.removeItem(key); } catch { /* best-effort */ }
    setRestored(false);
  };

  return { restored, clear };
}
