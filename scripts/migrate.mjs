import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const migrationsFolder = 'drizzle';
const databasePath =
	process.env.DATABASE_PATH ??
	(process.env.NODE_ENV === 'production'
		? '/data/algodrill.sqlite'
		: '.data/algodrill.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');

stampExistingBaseline(sqlite);

migrate(drizzle(sqlite), { migrationsFolder });
sqlite.close();
console.log(`Applied migrations to ${databasePath}`);

function stampExistingBaseline(sqlite) {
	sqlite
		.prepare(
			`CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at numeric
			)`
		)
		.run();
	const migrationCount = sqlite
		.prepare('select count(*) as count from __drizzle_migrations')
		.get()?.count;
	if (migrationCount !== 0) return;

	const baselineTables = [
		'accounts',
		'attempt_mistakes',
		'attempt_patterns',
		'attempts',
		'briefing_mistakes',
		'briefing_redos',
		'briefings',
		'mistakes',
		'patterns',
		'problem_topics',
		'problems',
		'session_queue',
		'sessions',
		'study_sessions',
		'timer_segments',
		'topics',
		'users',
		'verifications'
	];
	const existingTables = new Set(
		sqlite
			.prepare(
				"select name from sqlite_master where type = 'table' and name not like 'sqlite_%'"
			)
			.all()
			.map((row) => row.name)
	);
	const hasBaseline = baselineTables.every((table) =>
		existingTables.has(table)
	);
	if (!hasBaseline) return;

	const journal = JSON.parse(
		readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf8')
	);
	const insertMigration = sqlite.prepare(
		'insert into __drizzle_migrations ("hash", "created_at") values (?, ?)'
	);
	for (const entry of journal.entries) {
		const sql = readFileSync(`${migrationsFolder}/${entry.tag}.sql`, 'utf8');
		const hash = createHash('sha256').update(sql).digest('hex');
		insertMigration.run(hash, entry.when);
	}
	console.log('Stamped existing baseline schema in __drizzle_migrations');
}
