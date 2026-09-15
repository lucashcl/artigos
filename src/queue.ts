import { getDb } from "./db/drizzle";
import { processArticle } from "./services/article.service";

export async function queue(
   batch: MessageBatch<{ id: string; url: string }>,
   env: CloudflareBindings,
) {
   const db = getDb(env.summaries_db);

   await Promise.allSettled(
      batch.messages.map(async (message) => {
         const [status, error] = await processArticle(db, message.body, {
            apiKey: env.OPENROUTER_API_KEY,
            model: env.OPENROUTER_MODEL,
         });

         if (error) {
            console.error("Failed to process article", {
               id: message.body.id,
               url: message.body.url,
               error,
            });
         } else if (status === "skipped") {
            console.log(`Skipping article ${message.body.id}: not pending`);
         }

         message.ack();
      }),
   );
}
