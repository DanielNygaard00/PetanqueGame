export function validateMatch(body: Record<string, any>): string | null {
  if (!body?.Dato) return "Dato is required";
  const teams = body?.teams;
  if (!Array.isArray(teams) || teams.length < 2) return "At least two teams are required";
  for (const t of teams) {
    const players = Array.isArray(t?.players)
      ? t.players.filter((p: unknown) => typeof p === "string" && p.trim() !== "")
      : [];
    if (players.length < 1) return "Each team needs at least one player";
    const s = t?.score;
    if (s !== undefined && s !== null && s !== "") {
      if (!Number.isInteger(s) || s < 0 || s > 50) return "score must be an integer 0..50";
    }
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
