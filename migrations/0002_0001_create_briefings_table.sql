-- Migration number: 0002 	 2026-03-04T14:15:25.393Z

CREATE TABLE IF NOT EXISTS briefings (
  date TEXT PRIMARY KEY NOT NULL,
  collectedTime TEXT,
  deduplicatedTime TEXT,
  deduplicatedUsage TEXT,
  summarizedTime TEXT,
  summarizedUsage TEXT,
  publishedToWebsiteTime TEXT,
  posts TEXT,
  createdAt TEXT DEFAULT (datetime('now')),
  updatedAt TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_briefings_collectedTime ON briefings(collectedTime);
CREATE INDEX IF NOT EXISTS idx_briefings_deduplicatedTime ON briefings(deduplicatedTime);
CREATE INDEX IF NOT EXISTS idx_briefings_summarizedTime ON briefings(summarizedTime);
CREATE INDEX IF NOT EXISTS idx_briefings_publishedToWebsiteTime ON briefings(publishedToWebsiteTime);
