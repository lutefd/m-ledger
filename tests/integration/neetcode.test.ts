import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../src/lib/server/db/client';
import * as schema from '../../src/lib/server/db/schema';
import {
	attempts,
	externalSolves,
	problems,
	users
} from '../../src/lib/server/db/schema';
import type { GitHubClient } from '../../src/lib/server/services/github';
import { getProblemHistory } from '../../src/lib/server/services/sessions';
import {
	importNeetCodeSubmissions,
	syncNeetCodeHistory,
	type NeetCodeConfig
} from '../../src/lib/server/services/neetcode';

let sqlite: Database.Database;
let db: Db;

const repository = 'lutefd/neetcode-submissions';
const course = 'Data Structures & Algorithms';
const paths = [
	'baseball-game',
	'concatenation-of-array',
	'design-linked-list',
	'max-consecutive-ones',
	'merge-two-sorted-linked-lists',
	'minimum-stack',
	'remove-element',
	'replace-elements-with-greatest-element-on-right-side',
	'reverse-a-linked-list',
	'validate-parentheses'
].flatMap((slug, slugIndex) => {
	const count =
		slug === 'minimum-stack' ? 2 : slug.includes('replace-') ? 3 : 1;
	return Array.from({ length: count }, (_, submissionIndex) => ({
		path: `${course}/${slug}/submission-${submissionIndex}.go`,
		sha: `sha-${slugIndex}-${submissionIndex}`
	}));
});

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
		.values({
			id,
			name: id,
			email: `${id}@example.com`,
			emailVerified: true
		})
		.run();
}

function seedLeetCodeProblem(slug: string, userId = 'user-1') {
	db.insert(problems)
		.values({
			id: `leetcode-${slug}`,
			userId,
			url: `https://leetcode.com/problems/${slug}/`,
			slug,
			title: slug,
			createdAt: '2026-08-01T00:00:00.000Z',
			updatedAt: '2026-08-01T00:00:00.000Z'
		})
		.run();
}

function input(
	path: string,
	sha = 'commit-sha',
	submittedAt = '2026-08-11T12:00:00.000Z'
) {
	return {
		repository,
		path,
		commitSha: sha,
		submittedAt
	};
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

describe('NeetCode imports', () => {
	it('imports multiple submissions into one provider-specific problem', () => {
		seedUser();
		const result = importNeetCodeSubmissions(db, 'user-1', [
			input(`${course}/two-sum/submission-0.go`),
			input(`${course}/two-sum/submission-1.go`, 'commit-2'),
			input('README.md')
		]);

		expect(result).toEqual({
			imported: 2,
			updated: 0,
			ignored: 1,
			problemsCreated: 1
		});
		expect(db.select().from(externalSolves).all()).toHaveLength(2);
		expect(db.select().from(problems).all()).toMatchObject([
			{
				provider: 'neetcode',
				slug: 'two-sum',
				url: 'https://neetcode.io/problems/two-sum/question'
			}
		]);
		expect(db.select().from(attempts).all()).toHaveLength(0);
	});

	it('keeps LeetCode and NeetCode catalog entries separate', () => {
		seedUser();
		seedLeetCodeProblem('two-sum');
		importNeetCodeSubmissions(db, 'user-1', [
			input(`${course}/two-sum/submission-0.go`)
		]);

		expect(
			db
				.select()
				.from(problems)
				.all()
				.map((problem) => [problem.provider, problem.url])
		).toEqual([
			['leetcode', 'https://leetcode.com/problems/two-sum/'],
			['neetcode', 'https://neetcode.io/problems/two-sum/question']
		]);
	});

	it('is idempotent on webhook redelivery and retains removed source history', () => {
		seedUser();
		const path = `${course}/two-sum/submission-0.go`;
		const first = importNeetCodeSubmissions(db, 'user-1', [input(path)]);
		const second = importNeetCodeSubmissions(db, 'user-1', [
			input(path, 'newer-sha', '2026-08-11T13:00:00.000Z')
		]);
		const afterRemoval = importNeetCodeSubmissions(db, 'user-1', []);

		expect(first.imported).toBe(1);
		expect(second).toMatchObject({ imported: 0, updated: 1 });
		expect(afterRemoval).toMatchObject({ imported: 0, updated: 0 });
		expect(db.select().from(externalSolves).all()).toHaveLength(1);
		expect(db.select().from(externalSolves).all()[0]).toMatchObject({
			commitSha: 'newer-sha'
		});
	});

	it('rolls back the problem and earlier solve when a later submission is invalid', () => {
		seedUser();
		expect(() =>
			importNeetCodeSubmissions(db, 'user-1', [
				input(`${course}/two-sum/submission-0.go`),
				input(`${course}/three-sum/submission-0.go`, 'bad', 'not-a-date')
			])
		).toThrow('valid ISO date');

		expect(db.select().from(problems).all()).toHaveLength(0);
		expect(db.select().from(externalSolves).all()).toHaveLength(0);
	});
});

describe('NeetCode history backfill', () => {
	function fakeClient(currentPaths = paths): GitHubClient {
		return {
			async getRepository() {
				return { fullName: repository, defaultBranch: 'main' };
			},
			async getTree() {
				return [
					...currentPaths.map(({ path, sha }) => ({
						path,
						type: 'blob',
						sha
					})),
					{ path: 'README.md', type: 'blob', sha: 'readme' }
				];
			},
			async getLatestFileCommit(_repository, path) {
				const match = currentPaths.find((entry) => entry.path === path);
				return {
					sha: match?.sha ?? 'missing',
					date: '2026-08-11T12:00:00.000Z'
				};
			}
		};
	}

	const config: NeetCodeConfig = {
		repository,
		importUserEmail: 'user-1@example.com',
		apiToken: 'test-token'
	};

	it('imports the current repository snapshot and is safe to run again', async () => {
		seedUser();
		const first = await syncNeetCodeHistory(db, 'user-1', {
			config,
			client: fakeClient()
		});
		const second = await syncNeetCodeHistory(db, 'user-1', {
			config,
			client: fakeClient()
		});

		expect(first).toMatchObject({ imported: 13, problemsCreated: 10 });
		expect(second).toMatchObject({
			imported: 0,
			updated: 13,
			problemsCreated: 0
		});
		expect(db.select().from(externalSolves).all()).toHaveLength(13);
		expect(db.select().from(problems).all()).toHaveLength(10);
	});

	it('catches up a missed event without changing timed attempts', async () => {
		seedUser();
		const initialPaths = paths.slice(0, 12);
		await syncNeetCodeHistory(db, 'user-1', {
			config,
			client: fakeClient(initialPaths)
		});
		const result = await syncNeetCodeHistory(db, 'user-1', {
			config,
			client: fakeClient()
		});

		expect(result.imported).toBe(1);
		expect(db.select().from(externalSolves).all()).toHaveLength(13);
		expect(db.select().from(attempts).all()).toHaveLength(0);
	});

	it('returns external history separately from timed history', async () => {
		seedUser();
		importNeetCodeSubmissions(db, 'user-1', [
			input(`${course}/two-sum/submission-0.go`)
		]);
		const neetcodeProblem = db
			.select()
			.from(problems)
			.where(eq(problems.provider, 'neetcode'))
			.get()!;

		const detail = await getProblemHistory(db, 'user-1', neetcodeProblem.id);
		expect(detail?.history).toEqual([]);
		expect(detail?.externalSolves).toHaveLength(1);
		expect(detail?.totalMs).toBe(0);
	});
});
