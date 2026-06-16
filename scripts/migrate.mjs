import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const databasePath =
	process.env.DATABASE_PATH ??
	(process.env.NODE_ENV === 'production'
		? '/data/mistake-ledger.sqlite'
		: '.data/mistake-ledger.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

migrate(drizzle(sqlite), { migrationsFolder: 'drizzle' });
sqlite.close();
console.log(`Applied migrations to ${databasePath}`);
