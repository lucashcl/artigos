import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from 'hono/logger'
import { timeout } from 'hono/timeout'
import { QueueItem, Summary } from './types'

export const api = new Hono<{ Bindings: CloudflareBindings }>()

api.use(
   cors({ origin: '*' }),
   secureHeaders(),
   logger(),
   timeout(5000)
)

// Auth middleware
api.use('*', (c, next) => {
   const auth = bearerAuth({ token: c.env.API_SECRET_KEY })
   return auth(c, next)
})

const createSummarySchema = z.object({
   url: z.url()
})

// POST /summaries - Create a new summary
api.post('/summaries', zValidator('json', createSummarySchema), async (c) => {
   const { url } = c.req.valid('json')

   const id = crypto.randomUUID()

   try {
      await c.env.summaries_db.prepare(
         `INSERT INTO queue_items (id, url, status) VALUES (?, ?, 'pending')`
      )
         .bind(id, url)
         .run()

      await c.env.summaries_queue.send({ id, url })

      const queueItem = await c.env.summaries_db.prepare(
         `SELECT id, url, status, created_at FROM queue_items WHERE id = ?`
      )
         .bind(id)
         .first<QueueItem>()

      return c.json(queueItem, 201)
   } catch {
      const existing = await c.env.summaries_db.prepare(
         `SELECT id, url, status, created_at FROM queue_items WHERE url = ?`
      )
         .bind(url)
         .first<QueueItem>()

      if (existing) {
         return c.json(existing, 200)
      }

      return c.json({ error: 'Failed to create queue item' }, 500)
   }
})

// GET /summaries/:id - Get a summary by ID
api.get('/summaries/:id', async (c) => {
   const id = c.req.param('id')

   const row = await c.env.summaries_db.prepare(
      `SELECT s.id, q.url, s.title, s.summary, s.tags, s.created_at
     FROM summaries s
      INNER JOIN queue_items q ON q.id = s.id
      WHERE s.id = ?`
   )
      .bind(id)
      .first<Summary>()

   if (!row) {
      return c.json({ error: 'Summary not found' }, 404)
   }

   return c.json({
      id: row.id,
      url: row.url,
      title: row.title,
      summary: row.summary,
      tags: JSON.parse(row.tags),
      created_at: row.created_at,
   })
})

// GET /summaries - List all summaries
api.get('/summaries', async (c) => {
   const { results } = await c.env.summaries_db.prepare(
      `SELECT s.id, q.url, s.title, s.summary, s.tags, s.created_at
     FROM summaries s
      INNER JOIN queue_items q ON q.id = s.id
     ORDER BY s.created_at DESC`
   ).all<Summary>()

   return c.json(
      results.map((row) => ({
         id: row.id,
         url: row.url,
         title: row.title,
         summary: row.summary,
         tags: JSON.parse(row.tags),
         created_at: row.created_at,
      }))
   )
})