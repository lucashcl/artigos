import { and, eq, sql } from "drizzle-orm";
import { queueItems, summaries } from "../db/schema";
import { getDb } from "../db/drizzle";
import { generateSummary } from "../lib/ai";
import { extractPdfText } from "../lib/pdf";
import { err, ok, Result } from "../lib/result";

type Database = ReturnType<typeof getDb>;

type ArticleSummary = {
   titulo: string;
   resumo: string;
   tags: string[];
};

export type ArticleProcessingConfig = {
   apiKey: string;
   model: string;
};

export type ProcessArticleResult = Result<"completed" | "skipped", Error>;

export async function claimArticleForProcessing(
   db: Database,
   id: string,
): Promise<boolean> {
   const result = await db
      .update(queueItems)
      .set({
         status: "processing",
         updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(queueItems.id, id), eq(queueItems.status, "pending")))
      .run();

   return result.meta.changes === 1;
}

export async function fetchArticlePdf(url: string): Promise<ArrayBuffer> {
   const response = await fetch(url);

   if (!response.ok) {
      throw new Error(
         `Failed to fetch article URL "${url}"\n${response.status} ${response.statusText}`,
      );
   }

   const contentType = response.headers.get("content-type") ?? "";
   if (!contentType.includes("application/pdf")) {
      throw new Error(`${url} is not a PDF file: ${contentType}`);
   }

   return response.arrayBuffer();
}

export async function generateArticleSummary(
   url: string,
   config: ArticleProcessingConfig,
): Promise<ArticleSummary> {
   const pdfBuffer = await fetchArticlePdf(url);
   const text = await extractPdfText(pdfBuffer);

   return generateSummary(text, config);
}

export async function completeArticleProcessing(
   db: Database,
   id: string,
   summary: ArticleSummary,
): Promise<void> {
   await db.batch([
      db
         .insert(summaries)
         .values({
            id,
            title: summary.titulo,
            summary: summary.resumo,
            tags: JSON.stringify(summary.tags),
         }),
      db
         .update(queueItems)
         .set({
            status: "completed",
            updatedAt: sql`datetime('now')`,
         })
         .where(and(eq(queueItems.id, id), eq(queueItems.status, "processing"))),
   ]);
}

export async function failArticleProcessing(
   db: Database,
   id: string,
): Promise<void> {
   await db
      .update(queueItems)
      .set({
         status: "failed",
         updatedAt: sql`datetime('now')`,
      })
      .where(and(eq(queueItems.id, id), eq(queueItems.status, "processing")))
      .run();
}

export async function processArticle(
   db: Database,
   article: { id: string; url: string },
   config: ArticleProcessingConfig,
): Promise<ProcessArticleResult> {
   const claimed = await claimArticleForProcessing(db, article.id);

   if (!claimed) {
      return ok("skipped");
   }

   try {
      const summary = await generateArticleSummary(article.url, config);
      await completeArticleProcessing(db, article.id, summary);
      return ok("completed");
   } catch (cause) {
      try {
         await failArticleProcessing(db, article.id);
      } catch (updateError) {
         return err(
            updateError instanceof Error
               ? updateError
               : new Error("Failed to mark article processing as failed"),
         );
      }

      return err(
         cause instanceof Error
            ? cause
            : new Error("Failed to process article"),
      );
   }
}
