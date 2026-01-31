import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertPropertyManager } from "@shared/schema";

export function usePropertyManagers() {
  return useQuery({
    queryKey: [api.propertyManagers.list.path],
    queryFn: async () => {
      const res = await fetch(api.propertyManagers.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch property managers");
      return api.propertyManagers.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePropertyManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPropertyManager) => {
      const validated = api.propertyManagers.create.input.parse(data);
      const res = await fetch(api.propertyManagers.create.path, {
        method: api.propertyManagers.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to create');
      return api.propertyManagers.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.propertyManagers.list.path] }),
  });
}

export function useUpdatePropertyManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertPropertyManager>) => {
      const validated = api.propertyManagers.update.input.parse(updates);
      const url = buildUrl(api.propertyManagers.update.path, { id });
      const res = await fetch(url, {
        method: api.propertyManagers.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to update');
      return api.propertyManagers.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.propertyManagers.list.path] }),
  });
}

export function useDeletePropertyManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.propertyManagers.delete.path, { id });
      const res = await fetch(url, { method: api.propertyManagers.delete.method, credentials: "include" });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.propertyManagers.list.path] }),
  });
}
