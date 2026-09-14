import { MiddlewareHandler } from "hono";
import { bearerAuth } from "hono/bearer-auth";

export const auth: MiddlewareHandler = (c, next) => {
  const auth = bearerAuth<{ Bindings: CloudflareBindings }>({
     token: c.env.API_SECRET_KEY,
  });
  return auth(c, next);
}
