// src/validate.ts
export function validateMatch(body: Record<string, any>): string | null {
  if (!body?.Dato) return "Dato is required";
  if (!body?.Spiller) return "Spiller is required";
  for (const key of ["Point", "Modstander_Point"]) {
    const v = body[key];
    if (v === undefined || v === null || v === "") continue;
    if (!Number.isInteger(v) || v < 0 || v > 50) return `${key} must be an integer 0..50`;
  }
  if (Array.isArray(body.drinks)) {
    for (const d of body.drinks) {
      if (d.count !== undefined && (!Number.isInteger(d.count) || d.count < 1)) {
        return "drink count must be an integer >= 1";
      }
    }
  }
  return null;
}
