import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/drizzle";
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
   const db = getDb(d1Database);
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
   const db = getDb(d1Database);
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
   const db = getDb(d1Database);
   const id = crypto.randomUUID();

   try {
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
   const db = getDb(d1Database);

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
