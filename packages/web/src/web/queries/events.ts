import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export type FeedFilters = {
  org?: string;
  foodOnly: boolean;
  freeOnly: boolean;
  eligibility?: string;
  minConfidence: number;
};

export function useToday(day?: string) {
  return useQuery(orpc.events.today.queryOptions({ input: { day, foodOnly: false } }));
}

export function useFeed(filters: FeedFilters) {
  return useQuery(orpc.events.feed.queryOptions({ input: { ...filters, limit: 150 } }));
}

export type Intent = "food_now" | "food_today" | "this_week" | "study" | "open_to_all";

/** Preset intents instead of a search box — always a defined answer. */
export function useDiscover(intent: Intent | null) {
  return useQuery(
    orpc.events.discover.queryOptions({
      input: { intent: (intent ?? "food_today") as Intent, limit: 40 },
      enabled: intent !== null,
    }),
  );
}

export function useStats() {
  return useQuery(orpc.events.stats.queryOptions({ staleTime: 10_000 }));
}

export function useProvenance(id: number | null) {
  return useQuery(
    orpc.events.provenance.queryOptions({ input: { id: id ?? 0 }, enabled: id !== null }),
  );
}
