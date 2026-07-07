// client/src/pages/RankingsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RankingsPage } from "./RankingsPage";
import { api } from "../api/client";
import type { Match } from "../api/types";

const pl = (n: string) => ({ id: n, name: n });
// One 2v2 match -> four rated players (1012, 1012, 988, 988)
const matches: Match[] = [{
  id: "1", Dato: "2026-07-01",
  teams: [
    { team: 0, score: 13, won: true, players: [pl("Ida"), pl("Ann")] },
    { team: 1, score: 7, won: false, players: [pl("Bo"), pl("Cy")] },
  ],
}];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><RankingsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RankingsPage podium", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders medals for the top 3 and starts the list at rank 4", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: matches } as any);
    renderPage();
    expect(await screen.findByText("🥇")).toBeInTheDocument();
    expect(screen.getByText("🥈")).toBeInTheDocument();
    expect(screen.getByText("🥉")).toBeInTheDocument();
    // Rank 4 appears in the remaining list; ranks 1-3 do not.
    expect(screen.getAllByText("4").length).toBeGreaterThan(0);
  });

  it("skips the podium with fewer than 3 rated players", async () => {
    const one: Match[] = [{
      id: "1", Dato: "2026-07-01",
      teams: [
        { team: 0, score: 13, won: true, players: [pl("Ida")] },
        { team: 1, score: 7, won: false, players: [pl("Bo")] },
      ],
    }];
    vi.spyOn(api, "get").mockResolvedValue({ data: one } as any);
    renderPage();
    expect(await screen.findAllByText("Ida")).toBeTruthy();
    expect(screen.queryByText("🥇")).not.toBeInTheDocument();
  });
});
