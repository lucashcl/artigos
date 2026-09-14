import { drizzle } from "drizzle-orm/d1";

export const getDb = (db: D1Database) => drizzle(db)
