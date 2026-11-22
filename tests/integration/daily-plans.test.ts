import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createGate, sessionGate } = vi.hoisted(() => ({
	createGate: { run: null as null | (() => Promise<void>) },
	sessionGate: { run: null as null | (() => Promise<void>) }
}));

vi.mock('../../src/lib/server/services/sessions', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../src/lib/server/services/sessions')
		>();
	return {
		...actual,
		createStudySession: async (
			...args: Parameters<typeof actual.createStudySession>
		) => {
			const sessionId = await actual.createStudySession(...args);
			const run = sessionGate.run;
			sessionGate.run = null;
			if (run) await run();
			return sessionId;
		}
	};
});

vi.mock('../../src/lib/server/services/problems', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('../../src/lib/server/services/problems')
		>();
	return {
		...actual,
		createProblem: async (...args: Parameters<typeof actual.createProblem>) => {
			const run = createGate.run;
			createGate.run = null;
			if (run) await run();
			return actual.createProblem(...args);
		}
	};
});
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
	deleteStudySession,
	getUnfinishedSession,
	pauseSession,
	renameStudySession,
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

	it('keeps the started plan when a session starts during replace', async () => {
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

		createGate.run = async () => {
			await startSessionFromDailyPlan(db, 'user-1', '2026-11-22');
		};

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
				error instanceof DailyPlanError && error.status === 409
		);

		const plan = await getDailyPlan(db, 'user-1', '2026-11-22');
		expect(plan?.started).toBe(true);
		expect(plan?.items.map((item) => item.slug)).toEqual(['two-sum']);
	});

	it('does not link a session when the plan changes before the link', async () => {
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

		sessionGate.run = async () => {
			await upsertDailyPlan(db, 'user-1', {
				date: '2026-11-22',
				items: [
					{
						url: 'https://leetcode.com/problems/valid-parentheses/',
						dueReason: 'D+1',
						source: 'bob'
					}
				]
			});
		};

		await expect(
			startSessionFromDailyPlan(db, 'user-1', '2026-11-22')
		).rejects.toSatisfy(
			(error: unknown) =>
				error instanceof DailyPlanError &&
				error.status === 409 &&
				error.message.includes('changed')
		);

		const plan = await getDailyPlan(db, 'user-1', '2026-11-22');
		expect(plan?.started).toBe(false);
		expect(plan?.items.map((item) => item.slug)).toEqual(['valid-parentheses']);
		expect(await getUnfinishedSession(db, 'user-1')).toBeUndefined();
	});

	it('lets Bob replace a plan after its study session is deleted', async () => {
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
		await deleteStudySession(db, 'user-1', sessionId);

		const cleared = await getDailyPlan(db, 'user-1', '2026-11-22');
		expect(cleared?.started).toBe(false);
		expect(cleared?.startedSessionId).toBeNull();

		const replaced = await upsertDailyPlan(db, 'user-1', {
			date: '2026-11-22',
			items: [
				{
					slug: 'valid-parentheses',
					dueReason: 'D+3',
					source: 'bob'
				}
			]
		});
		expect(replaced?.started).toBe(false);
		expect(replaced?.items.map((item) => item.slug)).toEqual([
			'valid-parentheses'
		]);
	});

	it('rejects two items that are the same LeetCode problem', async () => {
		await expect(
			upsertDailyPlan(db, 'user-1', {
				date: '2026-11-22',
				items: [
					{
						url: 'https://leetcode.com/problems/two-sum/',
						dueReason: 'D+1',
						source: 'bob'
					},
					{
						slug: 'two-sum',
						dueReason: 'D+3',
						source: 'bob'
					}
				]
			})
		).rejects.toSatisfy(
			(error: unknown) =>
				error instanceof DailyPlanError && error.status === 400
		);
		expect(await getDailyPlan(db, 'user-1', '2026-11-22')).toBeNull();
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

	it('names the session after the plan and exposes renames in the feed', async () => {
		const plan = await upsertDailyPlan(db, 'user-1', {
			date: '2026-11-22',
			name: '  Sliding window day  ',
			items: [
				{
					url: 'https://leetcode.com/problems/two-sum/',
					dueReason: 'D+1',
					source: 'bob'
				}
			]
		});
		expect(plan?.name).toBe('Sliding window day');

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

		const since = parseAttemptsSince('2020-01-01T00:00:00.000Z');
		const feed = await listCompletedAttemptsSince(db, 'user-1', since);
		expect(feed.attempts[0]?.sessionName).toBe('Sliding window day');

		seedUser('user-2');
		expect(await renameStudySession(db, 'user-2', sessionId, 'Not yours')).toBe(
			false
		);
		expect(await renameStudySession(db, 'user-1', sessionId, null)).toBe(true);
		const renamed = await listCompletedAttemptsSince(db, 'user-1', since);
		expect(renamed.attempts[0]?.sessionName).toBeNull();
	});

	it('leaves fromBotPlan false for a session no plan started', async () => {
		db.insert(problems)
			.values({
				id: 'manual-problem',
				userId: 'user-1',
				url: 'https://leetcode.com/problems/valid-parentheses/',
				slug: 'valid-parentheses',
				title: 'Valid Parentheses',
				createdAt: '2026-11-22T12:00:00.000Z',
				updatedAt: '2026-11-22T12:00:00.000Z'
			})
			.run();
		db.insert(schema.studySessions)
			.values({
				id: 'manual-session',
				userId: 'user-1',
				status: 'completed',
				startedAt: '2026-11-22T12:00:00.000Z',
				finishedAt: '2026-11-22T12:20:00.000Z'
			})
			.run();
		db.insert(attempts)
			.values({
				id: 'manual-attempt',
				userId: 'user-1',
				sessionId: 'manual-session',
				problemId: 'manual-problem',
				outcome: 'partial',
				confidence: 2,
				createdAt: '2026-11-22T12:00:00.000Z',
				completedAt: '2026-11-22T12:20:00.000Z'
			})
			.run();

		const feed = await listCompletedAttemptsSince(
			db,
			'user-1',
			parseAttemptsSince('2026-11-22T12:00:00.000Z')
		);
		expect(feed.attempts).toEqual([
			expect.objectContaining({
				slug: 'valid-parentheses',
				title: 'Valid Parentheses',
				fromBotPlan: false,
				outcome: 'partial'
			})
		]);
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
		db.insert(problems)
			.values({
				id: 'three-sum',
				userId: 'user-1',
				url: 'https://leetcode.com/problems/3sum/',
				slug: '3sum',
				title: '3Sum',
				createdAt: '2026-06-01T00:00:00.000Z',
				updatedAt: '2026-06-01T00:00:00.000Z'
			})
			.run();
		db.insert(attempts)
			.values([
				{
					id: 'attempt-due',
					userId: 'user-1',
					sessionId: 'session-1',
					problemId: 'two-sum',
					redoDate: '2026-06-10',
					createdAt: '2026-06-01T00:00:00.000Z',
					completedAt: '2026-06-01T00:30:00.000Z'
				},
				{
					id: 'attempt-tomorrow-local',
					userId: 'user-1',
					sessionId: 'session-1',
					problemId: 'three-sum',
					redoDate: '2026-06-11',
					createdAt: '2026-06-01T00:00:00.000Z',
					completedAt: '2026-06-01T00:40:00.000Z'
				}
			])
			.run();

		// Still June 10 in America/Sao_Paulo, already June 11 in UTC.
		// June 11 is due on the UTC calendar and not due locally yet.
		const localEvening = new Date('2026-06-11T02:30:00.000Z');
		const preview = await getBriefingPreview(db, 'user-1', localEvening);
		expect(preview.redos.map((redo) => redo.dueDate)).toEqual(['2026-06-10']);
	});
});
