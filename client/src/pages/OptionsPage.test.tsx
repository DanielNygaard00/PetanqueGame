// client/src/pages/OptionsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OptionsPage } from "./OptionsPage";
import { api } from "../api/client";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><OptionsPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockGets() {
  vi.spyOn(api, "get").mockImplementation(async (url: string) => {
    if (url === "/options/arenas") return { data: [{ id: "a1", name: "Parken", uses: 12 }] } as any;
    return { data: [] } as any;
  });
}

describe("OptionsPage", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders sections and usage counts", async () => {
    mockGets();
    renderPage();
    expect(await screen.findByText("Parken")).toBeInTheDocument();
    expect(screen.getByText(/bruges i 12 kampe/)).toBeInTheDocument();
    expect(screen.getByText("Arenaer")).toBeInTheDocument();
    expect(screen.getByText("Drikketyper")).toBeInTheDocument();
    expect((await screen.findAllByText("Ingen endnu")).length).toBe(4);
  });

  it("renames via the inline editor", async () => {
    mockGets();
    const patch = vi.spyOn(api, "patch").mockResolvedValue({ data: { id: "a1", name: "Kongens Have" } } as any);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Rediger" }));
    fireEvent.change(screen.getByDisplayValue("Parken"), { target: { value: "Kongens Have" } });
    fireEvent.click(screen.getByRole("button", { name: "Gem" }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/options/arenas/a1", { name: "Kongens Have" }));
  });

  it("deletes after confirm, including usage in the prompt", async () => {
    mockGets();
    const del = vi.spyOn(api, "delete").mockResolvedValue({ data: { ok: true } } as any);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Slet" }));
    expect(confirmSpy).toHaveBeenCalledWith('Slet "Parken"? Bruges i 12 kampe — kampene beholder teksten.');
    await waitFor(() => expect(del).toHaveBeenCalledWith("/options/arenas/a1"));
  });

  it("does not delete when confirm is declined", async () => {
    mockGets();
    const del = vi.spyOn(api, "delete");
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Slet" }));
    expect(del).not.toHaveBeenCalled();
  });
});
