import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const queueItemStatuses = [
   "pending",
   "processing",
   "completed",
   "failed",
] as const;

export type QueueItemStatus = (typeof queueItemStatuses)[number];

export const queueItems = sqliteTable(
   "queue_items",
   {
      id: text("id").primaryKey(),
      url: text("url").notNull().unique(),
      status: text("status", { enum: queueItemStatuses })
         .notNull()
         .default("pending"),
      updatedAt: text("updated_at")
         .notNull()
         .default(sql`(datetime('now'))`),
      createdAt: text("created_at")
         .notNull()
         .default(sql`(datetime('now'))`),
   },
   (table) => [
      index("idx_queue_items_status_created_at").on(
         table.status,
         table.createdAt,
      ),
   ],
);

export const summaries = sqliteTable("summaries", {
   id: text("id")
      .primaryKey()
      .references(() => queueItems.id, { onDelete: "cascade" }),
   title: text("title").notNull(),
   summary: text("summary").notNull(),
   tags: text("tags").notNull(),
   createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
});
