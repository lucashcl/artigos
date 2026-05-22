import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { logger } from "hono/logger";
import { timeout } from "hono/timeout";
import { QueueItem, SummaryDAO, SummaryDTO } from "./types";

export const api = new Hono<{ Bindings: CloudflareBindings }>().basePath(
   "/api/v1",
);

api.use(cors({ origin: "*" }), secureHeaders(), logger(), timeout(5000));

// Auth middleware
api.use("*", (c, next) => {
   const auth = bearerAuth({ token: c.env.API_SECRET_KEY });
   return auth(c, next);
});

const createSummarySchema = z.object({
   url: z.url(),
});

const mapSummary = (dao: SummaryDAO): SummaryDTO => ({
   id: dao.id,
   url: dao.url,
   status: dao.status,
   summary:
      dao.title && dao.summary && dao.tags
         ? {
              title: dao.title,
              summary: dao.summary,
              tags: JSON.parse(dao.tags),
           }
         : null,
   updatedAt: new Date(dao.updated_at),
   createdAt: new Date(dao.created_at),
});

// GET /summaries - List all summaries
api.get("/summaries", async (c) => {
   const { results } = await c.env.summaries_db
      .prepare(
         `
         SELECT q.id, q.url, q.status, s.title, s.summary, s.tags, q.updated_at, q.created_at
         FROM queue_items q
         LEFT JOIN summaries s ON q.id = s.id
         ORDER BY q.created_at
    `,
      )
      .all<SummaryDAO>();

   return c.json(results.map(mapSummary));
});

// GET /summaries/:id - Get a summary by ID
api.get("/summaries/:id", async (c) => {
   const id = c.req.param("id");

   const row = await c.env.summaries_db
      .prepare(
         `
         SELECT q.id, q.url, q.status, s.title, s.summary, s.tags, q.updated_at, q.created_at
         FROM queue_items q
         LEFT JOIN summaries s ON q.id = s.id
         WHERE s.id = ?
         LIMIT 1
      `,
      )
      .bind(id)
      .first<SummaryDAO>();

   if (!row) {
      return c.json({ error: "Summary not found" }, 404);
   }

   return c.json(mapSummary(row));
});

// POST /summaries - Create a new summary
api.post("/summaries", zValidator("json", createSummarySchema), async (c) => {
   const { url } = c.req.valid("json");

   const id = crypto.randomUUID();

   try {
      await c.env.summaries_db
         .prepare(
            `INSERT INTO queue_items (id, url, status) VALUES (?, ?, 'pending')`,
         )
         .bind(id, url)
         .run();

      await c.env.summaries_queue.send({ id, url });

      const queueItem = await c.env.summaries_db
         .prepare(
            `SELECT id, url, status, created_at FROM queue_items WHERE id = ?`,
         )
         .bind(id)
         .first<QueueItem>();

      return c.json(queueItem, 201);
   } catch {
      const existing = await c.env.summaries_db
         .prepare(
            `SELECT id, url, status, created_at FROM queue_items WHERE url = ?`,
         )
         .bind(url)
         .first<QueueItem>();

      if (existing) {
         return c.json(existing, 200);
      }

      return c.json({ error: "Failed to create queue item" }, 500);
   }
});

// POST /summaries/retry - Retry a failed summary
api.post("/summaries/:id/retry", async (c) => {
   const id = c.req.param("id");
   const existing = await c.env.summaries_db
      .prepare(
         `SELECT id, url, status, created_at FROM queue_items WHERE id = ?`,
      )
      .bind(id)
      .first<QueueItem>();

   if (!existing) {
      return c.json({ error: "Queue item not found" }, 404);
   }
   if (existing.status !== "failed") {
      return c.json({ error: "Only failed items can be retried" }, 400);
   }

   // Update status to pending and resend to queue
   await c.env.summaries_db
      .prepare(`UPDATE queue_items SET status = 'pending' WHERE id = ?`)
      .bind(id)
      .run();

   await c.env.summaries_queue.send({ id, url: existing.url });
   const queueItem = await c.env.summaries_db
      .prepare(
         `SELECT id, url, status, created_at FROM queue_items WHERE id = ?`,
      )
      .bind(id)
      .first<QueueItem>();
   return c.json(queueItem, 200);
});
