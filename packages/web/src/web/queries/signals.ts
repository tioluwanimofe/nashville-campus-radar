import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { clientId } from "../lib/alpha";

/** The alpha scoreboard: Discovery Rate, verifications, intent taps. Free to read. */
export function useSignals() {
  return useQuery(orpc.signals.summary.queryOptions({ refetchInterval: 20_000 }));
}

/** What this browser already answered, so buttons show their own state. */
export function useMyFeedback() {
  return useQuery(orpc.signals.mine.queryOptions({ input: { clientId: clientId() } }));
}

export function useSendFeedback() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.signals.feedback.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.signals.key() });
      },
    }),
  );
}

/** Fire-and-forget: which preset intent was pressed and whether it found anything. */
export function useLogIntent() {
  return useMutation(orpc.signals.intent.mutationOptions());
}
