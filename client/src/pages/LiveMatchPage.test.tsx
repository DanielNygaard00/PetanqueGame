// client/src/pages/LiveMatchPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LiveMatchPage } from "./LiveMatchPage";
import { api } from "../api/client";

function renderLive() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/live"]}>
        <Routes>
          <Route path="/live" element={<LiveMatchPage />} />
          <Route path="/matches/:id/edit" element={<div>EDIT</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockGets() {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/players") return { data: [{ id: "1", name: "Ida", games: 0 }, { id: "2", name: "Bo", games: 0 }] } as any;
    return { data: [] } as any; // matches, options
  });
}

describe("LiveMatchPage", () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it("plays a full match: setup, score to target, save", async () => {
    mockGets();
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: { id: "m1" } } as any);
    renderLive();

    // Setup: Ida on team 1, Bo on team 2
    fireEvent.click((await screen.findAllByRole("button", { name: "+ Ida" }))[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "+ Bo" })[1]);
    fireEvent.change(screen.getByLabelText("Målscore"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Start kamp" }));

    // Playing: tap team panel, then a point chip
    fireEvent.click(screen.getByRole("button", { name: /Ida/ }));
    fireEvent.click(screen.getByRole("button", { name: "+1" }));

    // Finished at target 1
    expect(await screen.findByText(/vinder/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gem kamp" }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/matches", expect.objectContaining({
      teams: [
        { score: 1, players: ["Ida"] },
        { score: 0, players: ["Bo"] },
      ],
    })));
    expect(await screen.findByText("EDIT")).toBeInTheDocument();
    expect(localStorage.getItem("liveMatch:v1")).toBeNull();
  });

  it("blocks start when a team is empty", async () => {
    mockGets();
    renderLive();
    fireEvent.click((await screen.findAllByRole("button", { name: "+ Ida" }))[0]);
    fireEvent.click(screen.getByRole("button", { name: "Start kamp" }));
    expect(screen.getByText("Hvert hold skal have mindst én spiller")).toBeInTheDocument();
  });

  it("restores a running session from localStorage", async () => {
    mockGets();
    localStorage.setItem("liveMatch:v1", JSON.stringify({
      status: "playing", startedAt: "2026-07-07T18:30", target: 13,
      teams: [{ players: ["Ida"], points: 4 }, { players: ["Bo"], points: 2 }],
      ends: [{ team: 0, points: 4 }, { team: 1, points: 2 }],
    }));
    renderLive();
    expect(await screen.findByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fortryd" })).toBeInTheDocument();
  });

  it("undo removes the last end", async () => {
    mockGets();
    localStorage.setItem("liveMatch:v1", JSON.stringify({
      status: "playing", startedAt: "2026-07-07T18:30", target: 13,
      teams: [{ players: ["Ida"], points: 4 }, { players: ["Bo"], points: 2 }],
      ends: [{ team: 0, points: 4 }, { team: 1, points: 2 }],
    }));
    renderLive();
    fireEvent.click(await screen.findByRole("button", { name: "Fortryd" }));
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });
});
