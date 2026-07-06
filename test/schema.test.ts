import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("schema 0004", () => {
  it("has match_players and drink attribution, and drops flat match columns", async () => {
    const mp = await env.DB.prepare("PRAGMA table_info(match_players)").all();
    const mpCols = (mp.results as { name: string }[]).map((r) => r.name).sort();
    expect(mpCols).toEqual(["id", "match_id", "player_id", "position", "score", "team"].sort());

    const md = await env.DB.prepare("PRAGMA table_info(match_drinks)").all();
    expect((md.results as { name: string }[]).some((r) => r.name === "player_id")).toBe(true);

    const m = await env.DB.prepare("PRAGMA table_info(matches)").all();
    const mCols = (m.results as { name: string }[]).map((r) => r.name);
    for (const gone of ["is_group", "group_members", "player", "opponent", "won", "points", "opponent_points"]) {
      expect(mCols).not.toContain(gone);
    }
    expect(mCols).toContain("date");
    expect(mCols).toContain("arena");
  });
});
