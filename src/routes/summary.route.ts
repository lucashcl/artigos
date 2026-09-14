import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
   createSummary,
   getSummaryById,
   listSummaries,
   retrySummary,
} from "../services/summary.service";

export const summaryRoutes = new Hono<{
   Bindings: CloudflareBindings;
}>();

const createSummarySchema = z.object({
   url: z.url(),
});

// GET /summaries - List all summaries
summaryRoutes.get("/summaries", async (c) => {
   const summaries = await listSummaries(c.env.summaries_db);
   return c.json(summaries);
});

// GET /summaries/:id - Get a summary by ID
summaryRoutes.get("/summaries/:id", async (c) => {
   const summary = await getSummaryById(c.env.summaries_db, c.req.param("id"));

   if (!summary) {
      return c.json({ error: "Summary not found" }, 404);
   }

   return c.json(summary);
});

// POST /summaries - Create a new summary
summaryRoutes.post(
   "/summaries",
   zValidator("json", createSummarySchema),
   async (c) => {
      const { url } = c.req.valid("json");
      const [result, error] = await createSummary(
         c.env.summaries_db,
         c.env.summaries_queue,
         url,
      );

      if (error) {
         return c.json({ error: "Failed to create queue item" }, 500);
      }

      return c.json(result.queueItem, result.created ? 201 : 200);
   },
);

// POST /summaries/:id/retry - Retry a failed summary
summaryRoutes.post("/summaries/:id/retry", async (c) => {
   const [queueItem, error] = await retrySummary(
      c.env.summaries_db,
      c.env.summaries_queue,
      c.req.param("id"),
   );

   if (error === "not_found") {
      return c.json({ error: "Queue item not found" }, 404);
   }

   if (error === "not_failed") {
      return c.json({ error: "Only failed items can be retried" }, 400);
   }

   return c.json(queueItem, 200);
});
