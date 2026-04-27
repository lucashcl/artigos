import { generateSummary } from "./ai"
import { Bindings } from "./env"
import { extractPdfText } from "./pdf"

export async function queue(batch: MessageBatch<{ id: string, url: string }>, env: Bindings) {
   for (const message of batch.messages) {
      console.log(`Processing queue item: ${message.body.id} - ${message.body.url}`)
      const { id, url } = message.body
      await env.summaries_db.prepare(
         `UPDATE queue_items
         SET status = 'processing', updated_at = datetime('now')
         WHERE id = ?`
      )
         .bind(id)
         .run()

      try {
         const existingSummary = await env.summaries_db.prepare(
            `SELECT id FROM summaries WHERE id = ?`
         )
            .bind(id)
            .first<{ id: string }>()

         if (existingSummary) {
            await env.summaries_db.prepare(
               `UPDATE queue_items
             SET status = 'completed', updated_at = datetime('now')
             WHERE id = ?`
            )
               .bind(id)
               .run()
            message.ack()
            continue
         }

         const res = await fetch(url)
         if (!res.ok) {
            await env.summaries_db.prepare(
               `UPDATE queue_items
             SET status = 'failed', updated_at = datetime('now')
             WHERE id = ?`
            )
               .bind(id)
               .run()
            continue
         }

         const contentType = res.headers.get('content-type') ?? ''
         if (!contentType.includes('application/pdf')) {
            await env.summaries_db.prepare(
               `UPDATE queue_items
             SET status = 'failed', updated_at = datetime('now')
             WHERE id = ?`
            )
               .bind(id)
               .run()
            continue
         }

         const buffer = await res.arrayBuffer()
         const text = await extractPdfText(buffer)
         const summary = await generateSummary(text, env.OPENAI_API_KEY)

         const tagsJson = JSON.stringify(summary.tags)

         await env.summaries_db.prepare(
            `INSERT INTO summaries (id, title, summary, tags) VALUES (?, ?, ?, ?)`
         )
            .bind(id, summary.titulo, summary.resumo, tagsJson)
            .run()

         await env.summaries_db.prepare(
            `UPDATE queue_items
           SET status = 'completed', updated_at = datetime('now')
           WHERE id = ?`
         )
            .bind(id)
            .run()
      } catch (error) {
         console.error(`Error processing queue item ${id}:`, error, error instanceof Error ? error.stack : null)
         await env.summaries_db.prepare(
            `UPDATE queue_items
           SET status = 'failed', updated_at = datetime('now')
           WHERE id = ?`
         )
            .bind(id)
            .run()
         continue
      }
   }
}
