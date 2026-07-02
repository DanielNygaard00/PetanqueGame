// client/src/api/hooks.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMatches, usePlayers } from "./hooks";
import { api } from "./client";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useMatches", () => {
  it("fetches matches", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "1", Spiller: "Ida" }] } as any);
    const { result } = renderHook(() => useMatches(), { wrapper });
    await waitFor(() => expect(result.current.data?.length).toBe(1));
    expect(result.current.data?.[0].Spiller).toBe("Ida");
  });
});

it("fetches players", async () => {
  vi.spyOn(api, "get").mockResolvedValue({ data: [{ id: "1", name: "Ida", games: 3 }] } as any);
  const { result } = renderHook(() => usePlayers(), { wrapper });
  await waitFor(() => expect(result.current.data?.[0].name).toBe("Ida"));
});
