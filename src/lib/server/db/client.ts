import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { env } from '$lib/server/env';

export function createSqlite(path = env.DATABASE_PATH) {
	const sqlite = new Database(path);
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('busy_timeout = 5000');
	return sqlite;
}

export const sqlite = createSqlite();
export const db = drizzle(sqlite, { schema });

export type Db = typeof db;
