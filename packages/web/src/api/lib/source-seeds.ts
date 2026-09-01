/**
 * Real, verified Nashville event sources. No sample data anywhere in this app —
 * if a source is down or blocks bots, Admin shows that plainly.
 */
export type SourceSeed = {
  name: string;
  org: string;
  kind: "html" | "rss" | "tribe";
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
    name: "Belmont University Events",
    org: "Belmont",
    kind: "html",
    url: "https://www.belmont.edu/events/",
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
    name: "Trevecca Events Calendar",
    org: "Trevecca",
    kind: "html",
    url: "https://www.trevecca.edu/events",
    campusLat: 36.1381,
    campusLng: -86.7443,
  },
  {
    name: "TSU Campus Event Calendar",
    org: "TSU",
    kind: "html",
    url: "https://www.tnstate.edu/campus_life/calendar.aspx",
    campusLat: 36.1697,
    campusLng: -86.8288,
  },
  {
    name: "Fisk University Events (WP feed)",
    org: "Fisk",
    kind: "tribe",
    url: "https://www.fisk.edu/wp-json/tribe/events/v1/events?per_page=50",
    campusLat: 36.1685,
    campusLng: -86.8047,
  },
  {
    name: "Nashville Public Library Events",
    org: "Nashville (non-campus)",
    kind: "html",
    url: "https://library.nashville.org/events/upcoming",
    campusLat: 36.1616,
    campusLng: -86.7823,
  },
  {
    name: "Eventbrite — Nashville free events",
    org: "Nashville (non-campus)",
    kind: "html",
    url: "https://www.eventbrite.com/d/tn--nashville/free--events/",
    campusLat: 36.1627,
    campusLng: -86.7816,
  },
];
