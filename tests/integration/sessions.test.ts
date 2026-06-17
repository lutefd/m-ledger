import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../src/lib/server/db/schema';
import type { Db } from '../../src/lib/server/db/client';
import {
	acknowledgeBriefing,
	activateProblem,
	createStudySession,
	pauseSession,
	saveRecap,
	updateSessionNotes
} from '../../src/lib/server/services/sessions';
import {
	createMistake,
	createPattern
} from '../../src/lib/server/services/catalog';
import {
	generateBriefing,
	getBriefingPreview
} from '../../src/lib/server/services/briefing';
import {
	attemptMistakes,
	attemptPatterns,
	attempts,
	briefingRedos,
	mistakes,
	patterns,
	problems,
	studySessions,
	users
} from '../../src/lib/server/db/schema';

let sqlite: Database.Database;
let db: Db;

function migrate(sqlite: Database.Database) {
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
			if (sql) sqlite.exec(sql);
		}
	}
}

function seedUser(id: string) {
	db.insert(users)
		.values({
			id,
			name: id,
			email: `${id}@example.com`,
			emailVerified: true
		})
		.run();
}

function seedProblem(id: string, userId: string) {
	db.insert(problems)
		.values({
			id,
			userId,
			url: `https://leetcode.com/problems/${id}/`,
			slug: id,
			title: id,
			createdAt: '2026-06-01T00:00:00.000Z',
			updatedAt: '2026-06-01T00:00:00.000Z'
		})
		.run();
}

beforeEach(() => {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	migrate(sqlite);
	db = drizzle(sqlite, { schema });
});

afterEach(() => {
	sqlite.close();
});

describe('briefing redos', () => {
	it('uses the latest completed attempt before deciding whether a redo is due', async () => {
		seedUser('user-1');
		seedProblem('two-sum', 'user-1');
		db.insert(studySessions)
			.values([
				{
					id: 'session-old',
					userId: 'user-1',
					status: 'completed',
					startedAt: '2026-06-01T00:00:00.000Z',
					finishedAt: '2026-06-01T00:30:00.000Z'
				},
				{
					id: 'session-new',
					userId: 'user-1',
					status: 'completed',
					startedAt: '2026-06-09T00:00:00.000Z',
					finishedAt: '2026-06-09T00:30:00.000Z'
				},
				{
					id: 'session-briefing',
					userId: 'user-1',
					status: 'briefing',
					startedAt: '2026-06-10T00:00:00.000Z'
				}
			])
			.run();
		db.insert(attempts)
			.values([
				{
					id: 'attempt-old',
					userId: 'user-1',
					sessionId: 'session-old',
					problemId: 'two-sum',
					redoDate: '2026-06-07',
					createdAt: '2026-06-01T00:00:00.000Z',
					completedAt: '2026-06-01T00:30:00.000Z'
				},
				{
					id: 'attempt-new',
					userId: 'user-1',
					sessionId: 'session-new',
					problemId: 'two-sum',
					redoDate: '2026-06-20',
					createdAt: '2026-06-09T00:00:00.000Z',
					completedAt: '2026-06-09T00:30:00.000Z'
				}
			])
			.run();

		const preview = await getBriefingPreview(
			db,
			'user-1',
			new Date('2026-06-10T12:00:00.000Z')
		);
		expect(preview.redos).toEqual([]);

		const briefingId = await generateBriefing(
			db,
			'user-1',
			'session-briefing',
			new Date('2026-06-10T12:00:00.000Z')
		);
		expect(
			db
				.select()
				.from(briefingRedos)
				.where(eq(briefingRedos.briefingId, briefingId))
				.all()
		).toEqual([]);
	});
});

describe('session transitions', () => {
	it('does not allow pause to acknowledge a briefing implicitly', async () => {
		seedUser('user-1');
		seedProblem('two-sum', 'user-1');
		const sessionId = await createStudySession(db, 'user-1', ['two-sum']);

		await expect(pauseSession(db, 'user-1', sessionId)).rejects.toThrow(
			'Session cannot be paused.'
		);
		await expect(
			activateProblem(db, 'user-1', sessionId, 'two-sum')
		).rejects.toThrow('Session cannot be changed right now.');

		await acknowledgeBriefing(db, 'user-1', sessionId);
		await expect(
			activateProblem(db, 'user-1', sessionId, 'two-sum')
		).resolves.toBeUndefined();
	});

	it('rejects notebook saves for completed sessions', async () => {
		seedUser('user-1');
		seedProblem('two-sum', 'user-1');
		db.insert(studySessions)
			.values({
				id: 'completed-session',
				userId: 'user-1',
				status: 'completed',
				startedAt: '2026-06-01T00:00:00.000Z',
				finishedAt: '2026-06-01T00:30:00.000Z'
			})
			.run();

		await expect(
			updateSessionNotes(db, 'user-1', 'completed-session', {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }]
			})
		).rejects.toThrow('Session is not open.');
	});
});

describe('recap validation', () => {
	it('requires a paused session before saving recap', async () => {
		seedUser('user-1');
		seedProblem('two-sum', 'user-1');
		const sessionId = await createStudySession(db, 'user-1', ['two-sum']);
		await acknowledgeBriefing(db, 'user-1', sessionId);
		await activateProblem(db, 'user-1', sessionId, 'two-sum');
		const attempt = db.select().from(attempts).get()!;

		await expect(
			saveRecap(db, 'user-1', sessionId, [
				{
					attemptId: attempt.id,
					outcome: 'partial',
					confidence: 3,
					mistakeIds: [],
					patternIds: []
				}
			])
		).rejects.toThrow('Session cannot be recapped.');

		await pauseSession(db, 'user-1', sessionId);
		await expect(
			saveRecap(db, 'user-1', sessionId, [
				{
					attemptId: attempt.id,
					outcome: 'partial',
					confidence: 3,
					mistakeIds: [],
					patternIds: []
				}
			])
		).resolves.toBeUndefined();
	});

	it('rejects mistakes and patterns that belong to another user', async () => {
		seedUser('user-1');
		seedUser('user-2');
		seedProblem('two-sum', 'user-1');
		const sessionId = await createStudySession(db, 'user-1', ['two-sum']);
		await acknowledgeBriefing(db, 'user-1', sessionId);
		await activateProblem(db, 'user-1', sessionId, 'two-sum');
		const attempt = db.select().from(attempts).get()!;
		await pauseSession(db, 'user-1', sessionId);

		db.insert(mistakes)
			.values({
				id: 'foreign-mistake',
				userId: 'user-2',
				name: 'Foreign',
				normalizedName: 'foreign'
			})
			.run();
		db.insert(patterns)
			.values({
				id: 'foreign-pattern',
				userId: 'user-2',
				name: 'Foreign',
				normalizedName: 'foreign'
			})
			.run();

		await expect(
			saveRecap(db, 'user-1', sessionId, [
				{
					attemptId: attempt.id,
					outcome: 'partial',
					confidence: 3,
					mistakeIds: ['foreign-mistake'],
					patternIds: []
				}
			])
		).rejects.toThrow('One or more mistakes were not found.');

		await expect(
			saveRecap(db, 'user-1', sessionId, [
				{
					attemptId: attempt.id,
					outcome: 'partial',
					confidence: 3,
					mistakeIds: [],
					patternIds: ['foreign-pattern']
				}
			])
		).rejects.toThrow('One or more patterns were not found.');

		expect(db.select().from(attemptMistakes).all()).toEqual([]);
		expect(db.select().from(attemptPatterns).all()).toEqual([]);
	});
});

describe('catalog creation', () => {
	it('rejects blank mistake and pattern names in service logic', async () => {
		seedUser('user-1');

		await expect(
			createMistake(db, { userId: 'user-1', name: '   ' })
		).rejects.toThrow('Name is required.');
		await expect(
			createPattern(db, { userId: 'user-1', name: '   ' })
		).rejects.toThrow('Name is required.');
	});
});
