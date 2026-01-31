import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertPrivateCustomer } from "@shared/schema";

export function usePrivateCustomers() {
  return useQuery({
    queryKey: [api.privateCustomers.list.path],
    queryFn: async () => {
      const res = await fetch(api.privateCustomers.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch private customers");
      return api.privateCustomers.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePrivateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertPrivateCustomer) => {
      const validated = api.privateCustomers.create.input.parse(data);
      const res = await fetch(api.privateCustomers.create.path, {
        method: api.privateCustomers.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to create');
      return api.privateCustomers.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.privateCustomers.list.path] }),
  });
}

export function useUpdatePrivateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertPrivateCustomer>) => {
      const validated = api.privateCustomers.update.input.parse(updates);
      const url = buildUrl(api.privateCustomers.update.path, { id });
      const res = await fetch(url, {
        method: api.privateCustomers.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to update');
      return api.privateCustomers.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.privateCustomers.list.path] }),
  });
}

export function useDeletePrivateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.privateCustomers.delete.path, { id });
      const res = await fetch(url, { method: api.privateCustomers.delete.method, credentials: "include" });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.privateCustomers.list.path] }),
  });
}
