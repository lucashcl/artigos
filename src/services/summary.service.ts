import { drizzle } from "drizzle-orm/d1";
import { and, asc, eq } from "drizzle-orm";
import { queueItems, summaries } from "../db/schema";
import { QueueItem, SummaryDAO, SummaryDTO } from "../lib/types";
import { err, ok, Result } from "../lib/result";

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

export async function listSummaries(
   d1Database: D1Database,
): Promise<SummaryDTO[]> {
   const db = drizzle(d1Database);

   // Implementação anterior com D1:
   // const { results } = await d1Database
   //    .prepare(`
   //       SELECT q.id, q.url, q.status, s.title, s.summary, s.tags, q.updated_at, q.created_at
   //       FROM queue_items q
   //       LEFT JOIN summaries s ON q.id = s.id
   //       ORDER BY q.created_at
   //    `)
   //    .all<SummaryDAO>();
   // return results.map(mapSummary);

   const rows = await db
      .select({
         id: queueItems.id,
         url: queueItems.url,
         status: queueItems.status,
         title: summaries.title,
         summary: summaries.summary,
         tags: summaries.tags,
         updated_at: queueItems.updatedAt,
         created_at: queueItems.createdAt,
      })
      .from(queueItems)
      .leftJoin(summaries, eq(queueItems.id, summaries.id))
      .orderBy(asc(queueItems.createdAt));

   return rows.map(mapSummary);
}

export async function getSummaryById(
   d1Database: D1Database,
   id: string,
): Promise<SummaryDTO | null> {
   const db = drizzle(d1Database);

   // Implementação anterior com D1:
   // const row = await d1Database
   //    .prepare(`
   //       SELECT q.id, q.url, q.status, s.title, s.summary, s.tags, q.updated_at, q.created_at
   //       FROM queue_items q
   //       LEFT JOIN summaries s ON q.id = s.id
   //       WHERE q.id = ?
   //       LIMIT 1
   //    `)
   //    .bind(id)
   //    .first<SummaryDAO>();
   // return row ? mapSummary(row) : null;

   const [row] = await db
      .select({
         id: queueItems.id,
         url: queueItems.url,
         status: queueItems.status,
         title: summaries.title,
         summary: summaries.summary,
         tags: summaries.tags,
         updated_at: queueItems.updatedAt,
         created_at: queueItems.createdAt,
      })
      .from(queueItems)
      .leftJoin(summaries, eq(queueItems.id, summaries.id))
      .where(eq(queueItems.id, id))
      .limit(1);

   return row ? mapSummary(row) : null;
}

export type CreateSummaryResult = {
   queueItem: QueueItem;
   created: boolean;
};

export async function createSummary(
   d1Database: D1Database,
   queue: Queue,
   url: string,
): Promise<Result<CreateSummaryResult, "failed">> {
   const db = drizzle(d1Database);
   const id = crypto.randomUUID();

   try {
      // Implementação anterior com D1:
      // await d1Database
      //    .prepare(
      //       `INSERT INTO queue_items (id, url, status) VALUES (?, ?, 'pending')`,
      //    )
      //    .bind(id, url)
      //    .run();
      //
      // await queue.send({ id, url });
      //
      // const queueItem = await d1Database
      //    .prepare(
      //       `SELECT id, url, status, created_at FROM queue_items WHERE id = ?`,
      //    )
      //    .bind(id)
      //    .first<QueueItem>();

      await db
         .insert(queueItems)
         .values({ id, url, status: "pending" })
         .run();

      await queue.send({ id, url });

      const [queueItem] = await db
         .select({
            id: queueItems.id,
            url: queueItems.url,
            status: queueItems.status,
            created_at: queueItems.createdAt,
         })
         .from(queueItems)
         .where(eq(queueItems.id, id))
         .limit(1);

      if (!queueItem) {
         throw new Error("Queue item not found");
      }

      return ok({ queueItem, created: true });
   } catch {
      // Implementação anterior com D1:
      // const existing = await d1Database
      //    .prepare(
      //       `SELECT id, url, status, created_at FROM queue_items WHERE url = ?`,
      //    )
      //    .bind(url)
      //    .first<QueueItem>();

      const [existing] = await db
         .select({
            id: queueItems.id,
            url: queueItems.url,
            status: queueItems.status,
            created_at: queueItems.createdAt,
         })
         .from(queueItems)
         .where(eq(queueItems.url, url))
         .limit(1);

      if (!existing) {
         return err("failed");
      }

      return ok({ queueItem: existing, created: false });
   }
}

export async function retrySummary(
   d1Database: D1Database,
   queue: Queue,
   id: string,
): Promise<Result<QueueItem, "not_failed" | "not_found">> {
   const db = drizzle(d1Database);

   const [existing] = await db
      .select({
         id: queueItems.id,
         url: queueItems.url,
         status: queueItems.status,
         created_at: queueItems.createdAt,
      })
      .from(queueItems)
      .where(eq(queueItems.id, id))
      .limit(1);

   if (!existing) {
      return err("not_found")
   }

   if (existing.status !== "failed") {
      return err("not_failed");
   }

   await db
      .update(queueItems)
      .set({ status: "pending" })
      .where(and(eq(queueItems.id, id), eq(queueItems.status, "failed")))
      .run();

   await queue.send({ id, url: existing.url });

   return ok({ ...existing, status: "pending" });
}
