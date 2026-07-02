// client/src/api/hooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Match, Option, Player } from "./types";

export function useMatches() {
  return useQuery({ queryKey: ["matches"], queryFn: async () => (await api.get<Match[]>("/matches")).data });
}
export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<Match>) => (await api.post<Match>("/matches", m)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}
export function useUpdateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...m }: Partial<Match> & { id: string }) => (await api.put<Match>(`/matches/${id}`, m)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}
export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/matches/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}
export function useOptions(collection: string) {
  return useQuery({
    queryKey: ["options", collection],
    queryFn: async () => (await api.get<Option[]>(`/options/${collection}`)).data,
  });
}
export function useAddOption(collection: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<Option>(`/options/${collection}`, { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["options", collection] }),
  });
}

export function usePlayers() {
  return useQuery({ queryKey: ["players"], queryFn: async () => (await api.get<Player[]>("/players")).data });
}
export function useAddPlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => (await api.post<{ id: string; name: string }>("/players", { name })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["players"] }),
  });
}
export function useRenamePlayer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => (await api.patch(`/players/${id}`, { name })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); qc.invalidateQueries({ queryKey: ["matches"] }); },
  });
}
export function useMergePlayers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, intoId }: { id: string; intoId: string }) => (await api.post(`/players/${id}/merge`, { intoId })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["players"] }); qc.invalidateQueries({ queryKey: ["matches"] }); },
  });
}
