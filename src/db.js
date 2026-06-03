import { createClient } from '@libsql/client';
import 'dotenv/config';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tweets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      reply_count INTEGER DEFAULT 0,
      repost_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      views_count INTEGER DEFAULT 0,
      reply_to_id INTEGER DEFAULT NULL,
      is_repost_of INTEGER DEFAULT NULL,
      reposted_by TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_username TEXT NOT NULL,
      from_display_name TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tweet_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      UNIQUE(tweet_id, username)
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tweet_reposts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tweet_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      UNIQUE(tweet_id, username)
    )
  `);
}

export { db, initDB };
