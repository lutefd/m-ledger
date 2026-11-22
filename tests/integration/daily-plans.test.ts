import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../src/lib/server/db/schema';
import type { Db } from '../../src/lib/server/db/client';
import {
	DailyPlanError,
	getDailyPlan,
	startSessionFromDailyPlan,
	upsertDailyPlan
} from '../../src/lib/server/services/daily-plans';
import {
	acknowledgeBriefing,
	activateProblem,
	pauseSession,
	saveRecap
} from '../../src/lib/server/services/sessions';
import {
	listCompletedAttemptsSince,
	parseAttemptsSince
} from '../../src/lib/server/services/attempts-feed';
import {
	attempts,
	dailyPlanItems,
	dailyPlans,
	problems,
	users
} from '../../src/lib/server/db/schema';
import { getBriefingPreview } from '../../src/lib/server/services/briefing';

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

function seedUser(id = 'user-1') {
	db.insert(users)
		.values({
			id,
			name: id,
			email: `${id}@example.com`,
			emailVerified: true
		})
		.run();
}

beforeEach(() => {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	migrate(sqlite);
	db = drizzle(sqlite, { schema });
	seedUser();
});

afterEach(() => {
	sqlite.close();
});

describe('daily plans', () => {
	it('upserts problems by LeetCode URL and replaces an unstarted plan', async () => {
		const first = await upsertDailyPlan(db, 'user-1', {
			date: '2026-11-22',
			items: [
				{
					url: 'https://leetcode.com/problems/two-sum/',
					title: 'Two Sum',
					dueReason: 'D+1',
					source: 'bob'
				},
				{
					slug: 'valid-parentheses',
					dueReason: 'D+3 shaky',
					source: 'bob'
				}
			]
		});

		expect(first?.items).toHaveLength(2);
		expect(first?.items[0]?.slug).toBe('two-sum');
		expect(first?.items[1]?.slug).toBe('valid-parentheses');
		expect(db.select().from(problems).all()).toHaveLength(2);

		const second = await upsertDailyPlan(db, 'user-1', {
			date: '2026-11-22',
			items: [
				{
					url: 'https://leetcode.com/problems/two-sum/',
					dueReason: 'D+7',
					source: 'bob'
				}
			]
		});

		expect(second?.id).toBe(first?.id);
		expect(second?.items).toHaveLength(1);
		expect(second?.items[0]?.dueReason).toBe('D+7');
		expect(
			db
				.select()
				.from(dailyPlanItems)
				.where(eq(dailyPlanItems.planId, first!.id))
				.all()
		).toHaveLength(1);
		expect(await getDailyPlan(db, 'user-1', '2026-11-22')).toMatchObject({
			date: '2026-11-22',
			started: false
		});
	});

	it('rejects replacing a plan after Luis starts a session from it', async () => {
		await upsertDailyPlan(db, 'user-1', {
			date: '2026-11-22',
			items: [
				{
					url: 'https://leetcode.com/problems/two-sum/',
					dueReason: 'D+1',
					source: 'bob'
				}
			]
		});

		const sessionId = await startSessionFromDailyPlan(
			db,
			'user-1',
			'2026-11-22'
		);
		expect(sessionId).toBeTruthy();
		expect(
			db
				.select()
				.from(dailyPlans)
				.where(eq(dailyPlans.planDate, '2026-11-22'))
				.get()?.startedSessionId
		).toBe(sessionId);

		await expect(
			upsertDailyPlan(db, 'user-1', {
				date: '2026-11-22',
				items: [
					{
						url: 'https://leetcode.com/problems/valid-parentheses/',
						dueReason: 'D+1',
						source: 'bob'
					}
				]
			})
		).rejects.toSatisfy(
			(error: unknown) =>
				error instanceof DailyPlanError &&
				error.status === 409 &&
				error.message.includes('already started')
		);
	});

	it('returns completed attempts since a timestamp with fromBotPlan', async () => {
		await upsertDailyPlan(db, 'user-1', {
			date: '2026-11-22',
			items: [
				{
					url: 'https://leetcode.com/problems/two-sum/',
					dueReason: 'D+1',
					source: 'bob'
				}
			]
		});
		const sessionId = await startSessionFromDailyPlan(
			db,
			'user-1',
			'2026-11-22'
		);
		await acknowledgeBriefing(db, 'user-1', sessionId);
		const problem = db.select().from(problems).get()!;
		await activateProblem(db, 'user-1', sessionId, problem.id);
		const attempt = db.select().from(attempts).get()!;
		await pauseSession(db, 'user-1', sessionId);
		await saveRecap(db, 'user-1', sessionId, [
			{
				attemptId: attempt.id,
				outcome: 'solved_independently',
				confidence: 4,
				mistakeIds: [],
				patternIds: []
			}
		]);

		const completed = db.select().from(attempts).get()!;
		expect(completed.completedAt).toBeTruthy();

		const before = parseAttemptsSince('2020-01-01T00:00:00.000Z');
		const feed = await listCompletedAttemptsSince(db, 'user-1', before);
		expect(feed.attempts).toHaveLength(1);
		expect(feed.attempts[0]).toMatchObject({
			slug: 'two-sum',
			url: 'https://leetcode.com/problems/two-sum/',
			outcome: 'solved_independently',
			confidence: 4,
			fromBotPlan: true
		});

		const after = parseAttemptsSince(completed.completedAt!);
		const empty = await listCompletedAttemptsSince(db, 'user-1', after);
		expect(empty.attempts).toHaveLength(0);
	});
});

describe('due date timezone', () => {
	it('treats due redos with the local calendar day, not UTC dateOnly', async () => {
		db.insert(problems)
			.values({
				id: 'two-sum',
				userId: 'user-1',
				url: 'https://leetcode.com/problems/two-sum/',
				slug: 'two-sum',
				title: 'Two Sum',
				createdAt: '2026-06-01T00:00:00.000Z',
				updatedAt: '2026-06-01T00:00:00.000Z'
			})
			.run();
		db.insert(schema.studySessions)
			.values({
				id: 'session-1',
				userId: 'user-1',
				status: 'completed',
				startedAt: '2026-06-01T00:00:00.000Z',
				finishedAt: '2026-06-01T00:30:00.000Z'
			})
			.run();
		db.insert(attempts)
			.values({
				id: 'attempt-1',
				userId: 'user-1',
				sessionId: 'session-1',
				problemId: 'two-sum',
				redoDate: '2026-06-10',
				createdAt: '2026-06-01T00:00:00.000Z',
				completedAt: '2026-06-01T00:30:00.000Z'
			})
			.run();

		// Still June 10 in America/Sao_Paulo, already June 11 in UTC.
		const localEvening = new Date('2026-06-11T02:30:00.000Z');
		const preview = await getBriefingPreview(db, 'user-1', localEvening);
		expect(preview.redos.map((redo) => redo.dueDate)).toEqual(['2026-06-10']);
	});
});
