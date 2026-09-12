/**
 * Real, verified Nashville event sources. No sample data anywhere in this app —
 * if a source is down or blocks bots, Admin shows that plainly.
 */
export type SourceSeed = {
  name: string;
  org: string;
  kind: "html" | "rss" | "tribe" | "json" | "coursedog";
  url: string;
  campusLat?: number;
  campusLng?: number;
};

export const SOURCE_SEEDS: SourceSeed[] = [
  {
    name: "Events@Vanderbilt (LiveWhale feed)",
    org: "Vanderbilt",
    kind: "rss",
    url: "https://events.vanderbilt.edu/live/rss/events",
    campusLat: 36.1447,
    campusLng: -86.8027,
  },
  {
    name: "Belmont University Events (Trumba feed)",
    org: "Belmont",
    kind: "json",
    url: "https://www.trumba.com/calendars/belmont.json",
    campusLat: 36.1327,
    campusLng: -86.7938,
  },
  {
    name: "Lipscomb Upcoming Events",
    org: "Lipscomb",
    kind: "html",
    url: "https://lipscomb.edu/news/upcoming-events",
    campusLat: 36.1043,
    campusLng: -86.7969,
  },
  {
    name: "Lipscomb Student Events",
    org: "Lipscomb",
    kind: "html",
    url: "https://lipscomb.edu/news/upcoming-events/student-events",
    campusLat: 36.1043,
    campusLng: -86.7969,
  },
  {
    name: "Trevecca Events Calendar (Coursedog embed)",
    org: "Trevecca",
    kind: "coursedog",
    url: "https://tnu.events.prod.coursedog.com/upcoming",
    campusLat: 36.1381,
    campusLng: -86.7443,
  },
  {
    name: "Fisk University Events (WP feed)",
    org: "Fisk",
    kind: "tribe",
    url: "https://www.fisk.edu/wp-json/tribe/events/v1/events?per_page=50",
    campusLat: 36.1685,
    campusLng: -86.8047,
  },
];