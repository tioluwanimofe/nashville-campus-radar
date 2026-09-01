import { ORPCError } from "@orpc/server";

/**
 * Every procedure that spends AI credits goes through here.
 *
 * Alpha does not need accounts — it needs a hard wall between the handful of
 * procedures that cost money and the many that don't. Reads (Today, Feed,
 * Sources, provenance) are free forever and stay ungated. Scraping and
 * extraction are admin-only.
 *
 * Fails closed: if ADMIN_KEY is missing from the environment, nobody can spend
 * credits, including us.
 */
export function assertAdmin(key: string | undefined | null) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new ORPCError("FORBIDDEN", {
      message: "ADMIN_KEY is not set on the server, so credit-spending actions are disabled.",
    });
  }
  if (!key || key !== expected) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Admin key required — this action spends AI credits.",
    });
  }
}

/** Cheap check the admin page uses to unlock its UI without spending anything. */
export function isAdminKey(key: string | undefined | null) {
  const expected = process.env.ADMIN_KEY;
  return Boolean(expected && key && key === expected);
}
