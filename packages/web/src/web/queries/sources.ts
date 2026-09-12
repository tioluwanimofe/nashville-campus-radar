import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useSources() {
  return useQuery(orpc.sources.list.queryOptions());
}

export function useRuns() {
  return useQuery(orpc.sources.runs.queryOptions({ input: { limit: 25 }, refetchInterval: 8000 }));
}

export function useRawForRun(runId: number | null) {
  return useQuery(
    orpc.sources.rawForRun.queryOptions({
      input: { runId: runId ?? 0, limit: 8 },
      enabled: runId !== null,
    }),
  );
}

function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.sources.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.events.key() });
  };
}

export function useRunSource() {
  const invalidate = useInvalidateAll();
  return useMutation(orpc.sources.run.mutationOptions({ onSuccess: invalidate }));
}

export function useRunAll() {
  const invalidate = useInvalidateAll();
  return useMutation(orpc.sources.runAll.mutationOptions({ onSuccess: invalidate }));
}

export function useAddSource() {
  const invalidate = useInvalidateAll();
  return useMutation(orpc.sources.add.mutationOptions({ onSuccess: invalidate }));
}

export function useToggleSource() {
  const invalidate = useInvalidateAll();
  return useMutation(orpc.sources.toggle.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdateSource() {
  const invalidate = useInvalidateAll();
  return useMutation(orpc.sources.update.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveSource() {
  const invalidate = useInvalidateAll();
  return useMutation(orpc.sources.remove.mutationOptions({ onSuccess: invalidate }));
}
