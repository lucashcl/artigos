import { generateSummary } from "./ai"
import { extractPdfText } from "./pdf"

export async function queue(batch: MessageBatch<{ id: string, url: string }>, env: CloudflareBindings) {
   await Promise.allSettled(batch.messages.map(async (message) => {
      console.log(`Processing queue item: ${message.body.id} - ${message.body.url}`)
      const preparedUpdateStatus = env.summaries_db.prepare(`
         UPDATE queue_items
         SET status = ?, updated_at = datetime('now')
         WHERE id = ?
      `)
      const { id, url } = message.body
      const result = await env.summaries_db.prepare(`
         UPDATE queue_items
         SET status = 'processing', updated_at = datetime('now')
         WHERE url = ? AND status = 'pending'
      `)
         .bind(url)
         .run()

      if (result.meta.changes === 0) {
         console.log(`Queue item ${id} is already being processed by another worker.`)
         message.ack()
         return
      }

      message.ack()

      try {
         const res = await fetch(url)
         if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`)

         const contentType = res.headers.get('content-type') ?? ''
         if (!contentType.includes('application/pdf')) throw new Error(`${url} is not a PDF file: ${contentType}`)

         const buffer = await res.arrayBuffer()
         const text = await extractPdfText(buffer)

         const summary = await generateSummary(text, {
            apiKey: env.OPENROUTER_API_KEY,
            model: env.OPENROUTER_MODEL
         })
         await env.summaries_db.batch([
            env.summaries_db.prepare(
               `INSERT INTO summaries (id, title, summary, tags) VALUES (?, ?, ?, ?)`
            )
               .bind(id, summary.titulo, summary.resumo, JSON.stringify(summary.tags)),
            preparedUpdateStatus
               .bind('completed', id)
         ])

      } catch (error) {
         console.error(`Error processing queue item ${id}:`, error, error instanceof Error ? error.message : null)
         console.error(`Error cause:`, error instanceof Error ? error.cause : null)
         console.error(`Stack trace:`, error instanceof Error ? error.stack : null)
         await preparedUpdateStatus
            .bind('failed', id)
            .run()
      }
   }))
}
