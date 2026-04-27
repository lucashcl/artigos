DROP TABLE IF EXISTS queue_items;
DROP TABLE IF EXISTS summaries;
CREATE TABLE IF NOT EXISTS queue_items (
  id         TEXT PRIMARY KEY,
  url        TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS summaries (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  summary    TEXT NOT NULL,
  tags       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id) REFERENCES queue_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_queue_items_status_created_at ON queue_items(status, created_at);