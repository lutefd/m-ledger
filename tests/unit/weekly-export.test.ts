import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../src/lib/server/db/schema';
import type { Db } from '../../src/lib/server/db/client';
import {
	attemptMistakes,
	attemptPatterns,
	attempts,
	mistakes,
	patterns,
	problems,
	studySessions,
	timerSegments,
	users
} from '../../src/lib/server/db/schema';
import {
	defaultWeeklyExportStart,
	getWeeklyExport,
	parseWeeklyExportStart
} from '../../src/lib/server/services/weekly-export';

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

beforeEach(() => {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	migrate(sqlite);
	db = drizzle(sqlite, { schema });
	db.insert(users)
		.values({
			id: 'user-1',
			name: 'Test User',
			email: 'test@example.com',
			emailVerified: true
		})
		.run();
});

afterEach(() => {
	sqlite.close();
});

describe('weekly export', () => {
	it('defaults to the Monday of the current UTC week', () => {
		expect(defaultWeeklyExportStart(new Date('2026-06-18T12:00:00.000Z'))).toBe(
			'2026-06-15'
		);
		expect(parseWeeklyExportStart('2026-06-08')).toBe('2026-06-08');
		expect(() => parseWeeklyExportStart('2026-06-40')).toThrow(
			'weekStart must be a valid date.'
		);
	});

	it('exports completed attempts and latest redo prep for the week', async () => {
		db.insert(problems)
			.values([
				{
					id: 'two-sum',
					userId: 'user-1',
					url: 'https://leetcode.com/problems/two-sum/',
					slug: 'two-sum',
					title: 'Two Sum',
					difficulty: 'easy',
					createdAt: '2026-06-01T00:00:00.000Z',
					updatedAt: '2026-06-01T00:00:00.000Z'
				},
				{
					id: 'three-sum',
					userId: 'user-1',
					url: 'https://leetcode.com/problems/3sum/',
					slug: '3sum',
					title: '3Sum',
					difficulty: 'medium',
					createdAt: '2026-06-01T00:00:00.000Z',
					updatedAt: '2026-06-01T00:00:00.000Z'
				}
			])
			.run();
		db.insert(studySessions)
			.values([
				{
					id: 'session-old',
					userId: 'user-1',
					status: 'completed',
					startedAt: '2026-06-10T00:00:00.000Z',
					finishedAt: '2026-06-10T00:30:00.000Z'
				},
				{
					id: 'session-week',
					userId: 'user-1',
					status: 'completed',
					startedAt: '2026-06-16T00:00:00.000Z',
					finishedAt: '2026-06-16T00:30:00.000Z'
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
					outcome: 'stuck',
					confidence: 1,
					redoDate: '2026-06-16',
					createdAt: '2026-06-10T00:00:00.000Z',
					completedAt: '2026-06-10T00:30:00.000Z'
				},
				{
					id: 'attempt-week',
					userId: 'user-1',
					sessionId: 'session-week',
					problemId: 'two-sum',
					outcome: 'solved_independently',
					confidence: 4,
					redoDate: '2026-07-01',
					createdAt: '2026-06-16T00:00:00.000Z',
					completedAt: '2026-06-16T00:30:00.000Z'
				},
				{
					id: 'attempt-redo',
					userId: 'user-1',
					sessionId: 'session-week',
					problemId: 'three-sum',
					outcome: 'partial',
					confidence: 2,
					redoDate: '2026-06-21',
					createdAt: '2026-06-16T00:31:00.000Z',
					completedAt: '2026-06-16T01:00:00.000Z'
				}
			])
			.run();
		db.insert(timerSegments)
			.values({
				id: 'segment-week',
				userId: 'user-1',
				sessionId: 'session-week',
				attemptId: 'attempt-week',
				startedAt: '2026-06-16T00:00:00.000Z',
				endedAt: '2026-06-16T00:30:00.000Z'
			})
			.run();
		db.insert(mistakes)
			.values({
				id: 'bounds',
				userId: 'user-1',
				name: 'Boundary check',
				normalizedName: 'boundary check',
				guardrail: 'Check inclusive bounds first.'
			})
			.run();
		db.insert(patterns)
			.values({
				id: 'two-pointers',
				userId: 'user-1',
				name: 'Two pointers',
				normalizedName: 'two pointers',
				recognitionTrigger: 'Sorted pair search.'
			})
			.run();
		db.insert(attemptMistakes)
			.values({
				attemptId: 'attempt-week',
				mistakeId: 'bounds',
				note: 'Missed empty input.'
			})
			.run();
		db.insert(attemptPatterns)
			.values({
				attemptId: 'attempt-week',
				patternId: 'two-pointers',
				note: 'Used after sorting.'
			})
			.run();

		const result = await getWeeklyExport(db, 'user-1', {
			weekStart: '2026-06-15',
			now: new Date('2026-06-18T12:00:00.000Z')
		});

		expect(result.week).toEqual({ start: '2026-06-15', end: '2026-06-21' });
		expect(result.summary).toMatchObject({
			completedAttempts: 2,
			solvedIndependently: 1,
			needsRedo: 1,
			averageConfidence: 3
		});
		expect(result.attempts[0]).toMatchObject({
			id: 'attempt-week',
			elapsedMs: 1800000,
			problem: {
				title: 'Two Sum',
				slug: 'two-sum',
				url: 'https://leetcode.com/problems/two-sum/'
			},
			mistakes: [
				{
					id: 'bounds',
					name: 'Boundary check',
					note: 'Missed empty input.'
				}
			],
			patterns: [
				{
					id: 'two-pointers',
					name: 'Two pointers',
					note: 'Used after sorting.'
				}
			]
		});
		expect(result.redoQueue.map((redo) => redo.problem.slug)).toEqual(['3sum']);
	});
});
