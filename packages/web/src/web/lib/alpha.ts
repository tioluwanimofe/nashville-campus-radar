import { useCallback, useState } from "react";

const ADMIN_STORAGE = "campus-radar.adminKey";
const CLIENT_STORAGE = "campus-radar.clientId";

/**
 * An anonymous per-browser id. Not a login and not tracking — it exists so one
 * tester tapping "I went" twice counts once, and so the app can grey out the
 * buttons they already answered.
 */
export function clientId(): string {
  if (typeof localStorage === "undefined") return "server-render-noop";
  let id = localStorage.getItem(CLIENT_STORAGE);
  if (!id) {
    id = `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(CLIENT_STORAGE, id);
  }
  return id;
}

/**
 * The admin key, held only in this browser's localStorage and sent with the few
 * procedures that spend AI credits. Alpha does not need user accounts — it needs
 * one wall around the money.
 */
export function useAdminKey() {
  const [key, setKey] = useState(() =>
    typeof localStorage === "undefined" ? "" : (localStorage.getItem(ADMIN_STORAGE) ?? ""),
  );

  const save = useCallback((next: string) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(ADMIN_STORAGE, next);
    setKey(next);
  }, []);

  const clear = useCallback(() => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(ADMIN_STORAGE);
    setKey("");
  }, []);

  return { key, save, clear };
}
