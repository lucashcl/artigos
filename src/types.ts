export type Summary = {
   id: string
   url: string
   title: string
   summary: string
   tags: string
   created_at: string
}

export type QueueItem = {
   id: string
   url: string
   status: "pending" | "processing" | "completed" | "failed"
   created_at: string
}
