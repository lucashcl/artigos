export type Summary = {
   id: string;
   url: string;
   title: string;
   summary: string;
   tags: string;
   created_at: string;
};

export type QueueItem = {
   id: string;
   url: string;
   status: "pending" | "processing" | "completed" | "failed";
   created_at: string;
};

export type SummaryDTO = {
   id: string;
   url: string;
   status: QueueItem["status"];
   summary: {
      title: string;
      summary: string;
      tags: string[];
   } | null;
   updatedAt: Date;
   createdAt: Date;
};

export type SummaryDAO = {
   id: string;
   url: string;
   status: QueueItem["status"];
   title: string | null;
   summary: string | null;
   tags: string | null;
   updated_at: string;
   created_at: string;
};
