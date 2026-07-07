// client/src/live/liveMatch.test.ts
import { describe, it, expect } from "vitest";
import {
  initialLiveState, validateSetup, startMatch, scoreEnd, undoEnd,
  finishMatch, winnerIndex, toMatchInput, type LiveState,
} from "./liveMatch";

function readyState(): LiveState {
  const s = initialLiveState();
  return { ...s, teams: [{ players: ["Ida"], points: 0 }, { players: ["Bo"], points: 0 }] };
}
const playing = () => startMatch(readyState(), "2026-07-07T18:30");

describe("validateSetup", () => {
  it("requires a player on every team", () => {
    expect(validateSetup(initialLiveState())).toBe("Hvert hold skal have mindst én spiller");
    expect(validateSetup(readyState())).toBeNull();
  });
  it("rejects a player on both teams", () => {
    const s = readyState();
    s.teams[1].players.push("Ida");
    expect(validateSetup(s)).toBe("En spiller kan ikke være på begge hold");
  });
});

describe("startMatch", () => {
  it("stamps startedAt and flips to playing", () => {
    const s = playing();
    expect(s.status).toBe("playing");
    expect(s.startedAt).toBe("2026-07-07T18:30");
  });
  it("throws on invalid setup", () => {
    expect(() => startMatch(initialLiveState(), "2026-07-07T18:30")).toThrow();
  });
});

describe("scoreEnd", () => {
  it("accumulates points from ends", () => {
    let s = playing();
    s = scoreEnd(s, 0, 3);
    s = scoreEnd(s, 1, 2);
    s = scoreEnd(s, 0, 1);
    expect(s.teams[0].points).toBe(4);
    expect(s.teams[1].points).toBe(2);
    expect(s.ends).toHaveLength(3);
    expect(s.status).toBe("playing");
  });
  it("clamps end points to 1–6", () => {
    let s = playing();
    s = scoreEnd(s, 0, 9);
    expect(s.teams[0].points).toBe(6);
    s = scoreEnd(s, 1, 0);
    expect(s.teams[1].points).toBe(1);
  });
  it("auto-finishes when a team reaches the target", () => {
    let s = { ...playing(), target: 3 };
    s = scoreEnd(s, 0, 3);
    expect(s.status).toBe("finished");
    expect(winnerIndex(s)).toBe(0);
  });
  it("ignores scoring when not playing", () => {
    const s = readyState();
    expect(scoreEnd(s, 0, 2)).toBe(s);
  });
});

describe("undoEnd", () => {
  it("removes the last end and recomputes", () => {
    let s = playing();
    s = scoreEnd(s, 0, 2);
    s = scoreEnd(s, 1, 5);
    s = undoEnd(s);
    expect(s.teams[1].points).toBe(0);
    expect(s.ends).toHaveLength(1);
  });
  it("reopens a finished match", () => {
    let s = { ...playing(), target: 2 };
    s = scoreEnd(s, 0, 2);
    expect(s.status).toBe("finished");
    s = undoEnd(s);
    expect(s.status).toBe("playing");
    expect(s.teams[0].points).toBe(0);
  });
  it("is a no-op with no ends", () => {
    const s = playing();
    expect(undoEnd(s)).toBe(s);
  });
});

describe("finishMatch", () => {
  it("finishes early when scores differ", () => {
    let s = playing();
    s = scoreEnd(s, 0, 2);
    s = finishMatch(s);
    expect(s.status).toBe("finished");
    expect(winnerIndex(s)).toBe(0);
  });
  it("refuses to finish a tie", () => {
    const s = playing();
    expect(finishMatch(s).status).toBe("playing");
  });
});

describe("toMatchInput", () => {
  it("maps date, time, arena, teams", () => {
    let s: LiveState = { ...playing(), arena: "Fælledparken", target: 3 };
    s = scoreEnd(s, 1, 3);
    expect(toMatchInput(s)).toEqual({
      Dato: "2026-07-07",
      Tid: "18:30",
      Arena: "Fælledparken",
      teams: [
        { score: 0, players: ["Ida"] },
        { score: 3, players: ["Bo"] },
      ],
    });
  });
});
