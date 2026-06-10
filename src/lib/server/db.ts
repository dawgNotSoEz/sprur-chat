import Database from 'better-sqlite3';
import { env } from '$env/dynamic/private';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const dbPath = env.DATABASE_PATH || './spur-chat.db';

// Ensure the parent directory exists (for Render's persistent disk mount)
const dir = dirname(dbPath);
if (dir && dir !== '.') {
	mkdirSync(dir, { recursive: true });
}

// Export a single shared connection (synchronous)
export const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

/**
 * Run migrations on startup.
 * Creates tables if they don't exist.
 */
export function initDb(): void {
	db.exec(`
		CREATE TABLE IF NOT EXISTS conversations (
			id         TEXT PRIMARY KEY,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS messages (
			id              INTEGER PRIMARY KEY AUTOINCREMENT,
			conversation_id TEXT NOT NULL REFERENCES conversations(id),
			sender          TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
			text            TEXT NOT NULL,
			created_at      TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE INDEX IF NOT EXISTS idx_messages_conv
			ON messages(conversation_id, created_at);
	`);

	console.log('✅ Database initialised at', dbPath);
}