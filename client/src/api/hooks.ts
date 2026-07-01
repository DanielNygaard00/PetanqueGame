// client/src/api/hooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { Match, Option } from "./types";

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
