import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertJob } from "@shared/schema";

export function useJobs() {
  return useQuery({
    queryKey: [api.jobs.list.path],
    queryFn: async () => {
      const res = await fetch(api.jobs.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return api.jobs.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertJob) => {
      // Need to convert dates to ISO strings if needed, though Zod handles date objects
      const validated = api.jobs.create.input.parse(data);
      const res = await fetch(api.jobs.create.path, {
        method: api.jobs.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to create job');
      return api.jobs.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] }),
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertJob>) => {
      const validated = api.jobs.update.input.parse(updates);
      const url = buildUrl(api.jobs.update.path, { id });
      const res = await fetch(url, {
        method: api.jobs.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to update job');
      return api.jobs.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.jobs.list.path] }),
  });
}

export function useJobActions() {
  return {
    downloadPdf: async (id: number) => {
      const url = buildUrl(api.jobs.generatePdf.path, { id });
      window.open(url, '_blank');
    },
    sendEmail: async (id: number) => {
      const url = buildUrl(api.jobs.sendEmail.path, { id });
      const res = await fetch(url, { method: api.jobs.sendEmail.method, credentials: "include" });
      if (!res.ok) throw new Error('Failed to send email');
      return await res.json();
    }
  };
}
