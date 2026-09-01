import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useRecentSubmissions(limit = 12) {
  return useQuery(orpc.submissions.list.queryOptions({ input: { limit } }));
}

/** Everything still waiting on an AI call, for the admin queue. */
export function useQueuedSubmissions() {
  return useQuery(
    orpc.submissions.list.queryOptions({ input: { limit: 50, status: "queued" } }),
  );
}

/** Extracted and awaiting a human publish decision. */
export function useDraftedSubmissions() {
  return useQuery(
    orpc.submissions.list.queryOptions({ input: { limit: 50, status: "drafted" } }),
  );
}

export function useQueueCount() {
  return useQuery(orpc.submissions.queueCount.queryOptions({ refetchInterval: 15_000 }));
}

function useInvalidateSubmissions() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: orpc.submissions.key() });
    void queryClient.invalidateQueries({ queryKey: orpc.events.key() });
  };
}

/** PUBLIC. Zero AI calls — the paste is stored exactly as typed. */
export function useQueueSubmission() {
  const invalidate = useInvalidateSubmissions();
  return useMutation(orpc.submissions.queue.mutationOptions({ onSuccess: invalidate }));
}

/** ADMIN. One AI call for one queued paste. */
export function useExtractSubmission() {
  const invalidate = useInvalidateSubmissions();
  return useMutation(orpc.submissions.extract.mutationOptions({ onSuccess: invalidate }));
}

/** ADMIN. One AI call per queued paste, capped server-side. */
export function useExtractQueued() {
  const invalidate = useInvalidateSubmissions();
  return useMutation(orpc.submissions.extractQueued.mutationOptions({ onSuccess: invalidate }));
}

/** ADMIN. Free — a human confirming a draft into the public index. */
export function usePublishSubmission() {
  const invalidate = useInvalidateSubmissions();
  return useMutation(orpc.submissions.publish.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveSubmission() {
  const invalidate = useInvalidateSubmissions();
  return useMutation(orpc.submissions.remove.mutationOptions({ onSuccess: invalidate }));
}
