import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/lib/server/db/client';
import * as schema from '../../src/lib/server/db/schema';
import {
	attempts,
	externalSolves,
	externalSolveLinks,
	problems,
	studySessions,
	timerSegments,
	users
} from '../../src/lib/server/db/schema';
import {
	backfillExternalSolveLinks,
	reconcileExternalSolveLinksForAttempts
} from '../../src/lib/server/services/external-solve-links';
import { listHistory } from '../../src/lib/server/services/history';
import { importNeetCodeSubmissions } from '../../src/lib/server/services/neetcode';
import { getProblemHistory } from '../../src/lib/server/services/sessions';

let sqlite: Database.Database;
let db: Db;

const repository = 'lutefd/neetcode-submissions';
const course = 'Data Structures & Algorithms';

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

function seedUser(id = 'user-1') {
	db.insert(users)
		.values({ id, name: id, email: `${id}@example.com`, emailVerified: true })
		.run();
}

function seedProblem(id = 'problem-two-sum', userId = 'user-1') {
	db.insert(problems)
		.values({
			id,
			userId,
			provider: 'neetcode',
			url: 'https://neetcode.io/problems/two-sum/question',
			slug: 'two-sum',
			title: 'Two Sum',
			createdAt: '2026-08-01T00:00:00.000Z',
			updatedAt: '2026-08-01T00:00:00.000Z'
		})
		.run();
}

function seedAttempt(
	attemptId = 'attempt-1',
	problemId = 'problem-two-sum',
	startedAt = '2026-08-11T12:00:00.000Z',
	endedAt = '2026-08-11T12:20:00.000Z',
	userId = 'user-1'
) {
	const sessionId = `session-${attemptId}`;
	db.insert(studySessions)
		.values({
			id: sessionId,
			userId,
			status: 'completed',
			startedAt,
			finishedAt: endedAt
		})
		.run();
	db.insert(attempts)
		.values({
			id: attemptId,
			userId,
			sessionId,
			problemId,
			outcome: 'solved_independently',
			confidence: 4,
			redoDate: '2026-08-20',
			createdAt: startedAt,
			completedAt: endedAt
		})
		.run();
	db.insert(timerSegments)
		.values({
			id: `segment-${attemptId}`,
			userId,
			sessionId,
			attemptId,
			startedAt,
			endedAt
		})
		.run();
}

function importInput(
	path = `${course}/two-sum/submission-0.py`,
	commitSha = 'commit-1',
	submittedAt = '2026-08-11T12:10:00.000Z'
) {
	return { repository, path, commitSha, submittedAt };
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

describe('external solve relationships', () => {
	it('links an imported solve without creating or changing a timed attempt', () => {
		seedUser();
		seedProblem();
		seedAttempt();

		importNeetCodeSubmissions(db, 'user-1', [importInput()]);

		expect(db.select().from(attempts).all()).toHaveLength(1);
		expect(db.select().from(externalSolves).all()).toHaveLength(1);
		expect(db.select().from(externalSolveLinks).all()).toMatchObject([
			{
				attemptId: 'attempt-1',
				method: 'time_window',
				confidence: 'high'
			}
		]);
		expect(db.select().from(attempts).get()).toMatchObject({
			confidence: 4,
			redoDate: '2026-08-20'
		});
	});

	it('matches when the attempt closes after the external solve was imported', () => {
		seedUser();
		seedProblem();
		importNeetCodeSubmissions(db, 'user-1', [importInput()]);
		expect(db.select().from(externalSolveLinks).all()).toEqual([]);

		seedAttempt();
		reconcileExternalSolveLinksForAttempts(db, ['attempt-1']);

		expect(db.select().from(externalSolveLinks).all()).toHaveLength(1);
	});

	it('keeps a solve standalone when candidate attempts overlap', () => {
		seedUser();
		seedProblem();
		seedAttempt('attempt-1');
		seedAttempt(
			'attempt-2',
			'problem-two-sum',
			'2026-08-11T12:05:00.000Z',
			'2026-08-11T12:15:00.000Z'
		);

		importNeetCodeSubmissions(db, 'user-1', [importInput()]);

		expect(db.select().from(externalSolveLinks).all()).toEqual([]);
	});

	it('supports multiple accepted submissions for one timed attempt as separate links', async () => {
		seedUser();
		seedProblem();
		seedAttempt();

		importNeetCodeSubmissions(db, 'user-1', [
			importInput(`${course}/two-sum/submission-0.py`),
			importInput(
				`${course}/two-sum/submission-1.go`,
				'commit-2',
				'2026-08-11T12:15:00.000Z'
			)
		]);

		expect(db.select().from(externalSolveLinks).all()).toHaveLength(2);
		const items = await listHistory(db, 'user-1');
		expect(items).toHaveLength(2);
		expect(items.every((item) => item.externalSolve && item.timedAttempt)).toBe(
			true
		);
	});

	it('re-evaluates a changed submission timestamp without duplicating the solve', () => {
		seedUser();
		seedProblem();
		seedAttempt();
		const path = `${course}/two-sum/submission-0.py`;

		importNeetCodeSubmissions(db, 'user-1', [importInput(path)]);
		importNeetCodeSubmissions(db, 'user-1', [
			importInput(path, 'commit-2', '2026-08-11T13:00:00.000Z')
		]);

		expect(db.select().from(externalSolves).all()).toHaveLength(1);
		expect(db.select().from(externalSolveLinks).all()).toEqual([]);
	});

	it('is idempotent and keeps relationships through source removal', () => {
		seedUser();
		seedProblem();
		seedAttempt();
		const path = `${course}/two-sum/submission-0.py`;

		importNeetCodeSubmissions(db, 'user-1', [importInput(path)]);
		backfillExternalSolveLinks(db, 'user-1');
		backfillExternalSolveLinks(db, 'user-1');
		importNeetCodeSubmissions(db, 'user-1', []);

		expect(db.select().from(externalSolves).all()).toHaveLength(1);
		expect(db.select().from(externalSolveLinks).all()).toHaveLength(1);
	});

	it('retains only the independent source records in timed metrics and detail', async () => {
		seedUser();
		seedProblem();
		seedAttempt();
		importNeetCodeSubmissions(db, 'user-1', [importInput()]);

		const detail = await getProblemHistory(db, 'user-1', 'problem-two-sum');
		expect(detail?.history).toHaveLength(1);
		expect(detail?.history[0].relatedExternalSolves).toHaveLength(1);
		expect(detail?.externalSolves[0].linkedAttempt?.attemptId).toBe(
			'attempt-1'
		);
		expect(detail?.totalMs).toBe(20 * 60 * 1000);

		const problem = db
			.select()
			.from(problems)
			.where(
				and(eq(problems.userId, 'user-1'), eq(problems.id, 'problem-two-sum'))
			)
			.get();
		expect(problem?.provider).toBe('neetcode');
	});

	it('cascades links when either source record is removed', () => {
		seedUser();
		seedProblem();
		seedAttempt();
		importNeetCodeSubmissions(db, 'user-1', [importInput()]);
		const externalSolve = db.select().from(externalSolves).get()!;

		db.delete(externalSolves)
			.where(eq(externalSolves.id, externalSolve.id))
			.run();
		expect(db.select().from(externalSolveLinks).all()).toEqual([]);

		importNeetCodeSubmissions(db, 'user-1', [importInput()]);
		db.delete(attempts).where(eq(attempts.id, 'attempt-1')).run();
		expect(db.select().from(externalSolveLinks).all()).toEqual([]);
	});
});
