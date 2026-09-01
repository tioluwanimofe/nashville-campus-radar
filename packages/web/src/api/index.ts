import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { events } from "./routes/events";
import { ping } from "./routes/ping";
import { signals } from "./routes/signals";
import { sources } from "./routes/sources";
import { submissions } from "./routes/submissions";

export const router = {
  ping,
  events,
  sources,
  submissions,
  signals,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);

export default app;
