import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { summaryRoutes } from "./routes/summary.route";
import { auth } from "./middlewares/auth.middleware";

export const api = new Hono<{ Bindings: CloudflareBindings }>().basePath(
   "/api/v1",
);

api.use(cors({ origin: "*" }), secureHeaders(), logger(), timeout(5000));

// Auth middleware
api.use("*", auth)

api.route("/", summaryRoutes);
