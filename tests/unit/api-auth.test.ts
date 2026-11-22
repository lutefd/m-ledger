import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/lib/server/db/schema';
import type { Db } from '../../src/lib/server/db/client';
import { users } from '../../src/lib/server/db/schema';

const { TOKEN } = vi.hoisted(() => ({ TOKEN: 'a'.repeat(32) }));

vi.mock('$lib/server/env', () => ({
	env: {
		EXPORT_API_TOKEN: TOKEN,
		EXPORT_API_USER_EMAIL: 'owner@example.com'
	}
}));

import {
	bearerToken,
	resolveApiUserId
} from '../../src/lib/server/services/api-auth';

let sqlite: Database.Database;
let db: Db;

function migrate(sqliteDb: Database.Database) {
	const files = readdirSync(resolve(process.cwd(), 'drizzle'))
		.filter((file) => file.endsWith('.sql'))
		.sort();
	for (const file of files) {
		const migration = readFileSync(
			resolve(process.cwd(), 'drizzle', file),
			'utf8'
		);
		for (const statement of migration.split('--> statement-breakpoint')) {
			const sql = statement.trim();
			if (sql) sqliteDb.exec(sql);
		}
	}
}

beforeEach(() => {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	migrate(sqlite);
	db = drizzle(sqlite, { schema });
	db.insert(users)
		.values({
			id: 'owner',
			name: 'Owner',
			email: 'owner@example.com',
			emailVerified: true
		})
		.run();
});

afterEach(() => {
	sqlite.close();
});

describe('api bearer auth', () => {
	it('parses bearer tokens', () => {
		expect(bearerToken('Bearer secret')).toBe('secret');
		expect(bearerToken('bearer secret')).toBe('secret');
		expect(bearerToken('Basic secret')).toBeNull();
		expect(bearerToken(null)).toBeNull();
	});

	it('accepts a matching bearer token for the configured owner', async () => {
		const userId = await resolveApiUserId(
			db,
			{ user: null, session: null },
			`Bearer ${TOKEN}`
		);
		expect(userId).toBe('owner');
	});

	it('rejects missing or wrong tokens when there is no session', async () => {
		await expect(
			resolveApiUserId(db, { user: null, session: null }, null)
		).rejects.toMatchObject({ status: 401 });
		await expect(
			resolveApiUserId(
				db,
				{ user: null, session: null },
				'Bearer wrong-token-wrong-token-wrong'
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('prefers an authenticated session over the bearer token', async () => {
		const userId = await resolveApiUserId(
			db,
			{
				user: { id: 'session-user' } as App.Locals['user'],
				session: {} as App.Locals['session']
			},
			null
		);
		expect(userId).toBe('session-user');
	});
});
