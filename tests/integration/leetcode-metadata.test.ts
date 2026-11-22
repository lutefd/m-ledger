import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../src/lib/server/db/schema';
import type { Db } from '../../src/lib/server/db/client';
import {
	lookupLeetCodeMetadata,
	type LeetCodeMetadataLookup
} from '../../src/lib/server/services/leetcode-metadata';
import {
	createProblem,
	fillMissingLeetCodeDetails
} from '../../src/lib/server/services/problems';

let sqlite: Database.Database;
let db: Db;

beforeEach(() => {
	sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	for (const file of readdirSync(resolve(process.cwd(), 'drizzle'))
		.filter((name) => name.endsWith('.sql'))
		.sort()) {
		const migration = readFileSync(
			resolve(process.cwd(), 'drizzle', file),
			'utf8'
		);
		for (const statement of migration.split('--> statement-breakpoint')) {
			if (statement.trim()) sqlite.exec(statement.trim());
		}
	}
	db = drizzle(sqlite, { schema });
	db.insert(schema.users)
		.values({
			id: 'user-1',
			name: 'user-1',
			email: 'user-1@example.com',
			emailVerified: true
		})
		.run();
});

afterEach(() => sqlite.close());

function topicNamesFor(problemId: string) {
	return db
		.select({ name: schema.topics.name })
		.from(schema.problemTopics)
		.innerJoin(
			schema.topics,
			eq(schema.topics.id, schema.problemTopics.topicId)
		)
		.where(eq(schema.problemTopics.problemId, problemId))
		.all()
		.map((row) => row.name)
		.sort();
}

const longestSubstring: LeetCodeMetadataLookup = async () => ({
	title: 'Longest Substring Without Repeating Characters',
	difficulty: 'medium',
	topics: ['Hash Table', 'Sliding Window']
});

describe('LeetCode metadata lookup', () => {
	it('parses title, difficulty and topics from the GraphQL response', async () => {
		const fetchImpl = vi.fn(async () =>
			Response.json({
				data: {
					question: {
						title: 'Two Sum',
						difficulty: 'Easy',
						topicTags: [{ name: 'Array' }, { name: 'Hash Table' }]
					}
				}
			})
		);
		await expect(
			lookupLeetCodeMetadata('two-sum', fetchImpl as typeof fetch)
		).resolves.toEqual({
			title: 'Two Sum',
			difficulty: 'easy',
			topics: ['Array', 'Hash Table']
		});
	});

	it('returns null for unknown slugs, HTTP errors and network failures', async () => {
		const unknown = async () => Response.json({ data: { question: null } });
		const failing = async () => new Response('busy', { status: 503 });
		const offline = async () => {
			throw new TypeError('fetch failed');
		};
		for (const fetchImpl of [unknown, failing, offline]) {
			await expect(
				lookupLeetCodeMetadata('nope', fetchImpl as typeof fetch)
			).resolves.toBeNull();
		}
	});
});

describe('creating problems with LeetCode metadata', () => {
	it('fills title, difficulty and topics the user left blank', async () => {
		const problem = await createProblem(
			db,
			{
				userId: 'user-1',
				url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/'
			},
			longestSubstring
		);
		expect(problem).toMatchObject({
			title: 'Longest Substring Without Repeating Characters',
			difficulty: 'medium'
		});
		expect(topicNamesFor(problem.id)).toEqual(['Hash Table', 'Sliding Window']);
	});

	it('keeps what the user typed over LeetCode values', async () => {
		const problem = await createProblem(
			db,
			{
				userId: 'user-1',
				url: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/',
				title: 'LSWRC',
				difficulty: 'hard',
				topicNames: ['Strings']
			},
			longestSubstring
		);
		expect(problem).toMatchObject({ title: 'LSWRC', difficulty: 'hard' });
		expect(topicNamesFor(problem.id)).toEqual(['Strings']);
	});

	it('only looks up LeetCode problems', async () => {
		const lookup = vi.fn(longestSubstring);
		const problem = await createProblem(
			db,
			{
				userId: 'user-1',
				url: 'https://www.hackerrank.com/challenges/ctci-ransom-note/problem'
			},
			lookup
		);
		expect(lookup).not.toHaveBeenCalled();
		expect(problem.difficulty).toBeUndefined();
	});

	it('saves the problem from its URL when LeetCode is unavailable', async () => {
		const problem = await createProblem(
			db,
			{ userId: 'user-1', url: 'https://leetcode.com/problems/two-sum/' },
			async () => null
		);
		expect(problem).toMatchObject({ title: 'Two Sum', difficulty: undefined });
	});

	it('backfills an existing problem that has no difficulty yet', async () => {
		const url =
			'https://leetcode.com/problems/longest-substring-without-repeating-characters/';
		const first = await createProblem(
			db,
			{ userId: 'user-1', url },
			async () => null
		);
		const lookup = vi.fn(longestSubstring);
		const second = await createProblem(db, { userId: 'user-1', url }, lookup);
		expect(second).toMatchObject({ id: first.id, difficulty: 'medium' });
		expect(topicNamesFor(first.id)).toEqual(['Hash Table', 'Sliding Window']);

		await createProblem(db, { userId: 'user-1', url }, lookup);
		expect(lookup).toHaveBeenCalledTimes(1);
	});

	it('fills every LeetCode problem still missing a difficulty', async () => {
		for (const slug of ['two-sum', 'valid-parentheses']) {
			await createProblem(
				db,
				{ userId: 'user-1', url: `https://leetcode.com/problems/${slug}/` },
				async () => null
			);
		}
		const lookup: LeetCodeMetadataLookup = async (slug) =>
			slug === 'two-sum'
				? { title: 'Two Sum', difficulty: 'easy', topics: [] }
				: null;
		await expect(
			fillMissingLeetCodeDetails(db, 'user-1', lookup)
		).resolves.toEqual({ filled: 1, missing: 1 });
	});
});
