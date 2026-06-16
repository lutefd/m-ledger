import { and, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { problemTopics, problems, topics } from '$lib/server/db/schema';
import { isoNow } from '$lib/utils/dates';
import { normalizeName, titleFromSlug } from './normalize';

export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

export function parseLeetCodeProblemUrl(input: string) {
	const url = new URL(input);
	if (url.protocol !== 'https:' || url.hostname !== 'leetcode.com') {
		throw new Error('Use an HTTPS LeetCode problem URL.');
	}

	const parts = url.pathname.split('/').filter(Boolean);
	const problemsIndex = parts.indexOf('problems');
	const slug = problemsIndex >= 0 ? parts[problemsIndex + 1] : undefined;
	if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
		throw new Error(
			'Use a LeetCode URL like https://leetcode.com/problems/two-sum/.'
		);
	}

	return {
		slug,
		url: `https://leetcode.com/problems/${slug}/`,
		title: titleFromSlug(slug)
	};
}

export async function createProblem(
	db: Db,
	input: {
		userId: string;
		url: string;
		title?: string;
		difficulty?: ProblemDifficulty;
		topicNames?: string[];
	}
) {
	const parsed = parseLeetCodeProblemUrl(input.url);
	const existing = await db.query.problems.findFirst({
		where: and(eq(problems.userId, input.userId), eq(problems.url, parsed.url))
	});
	if (existing) return existing;

	const now = isoNow();
	const id = crypto.randomUUID();
	const problem = {
		id,
		userId: input.userId,
		url: parsed.url,
		slug: parsed.slug,
		title: input.title?.trim() || parsed.title,
		difficulty: input.difficulty,
		createdAt: now,
		updatedAt: now
	};

	db.transaction((tx) => {
		tx.insert(problems).values(problem).run();
		for (const name of input.topicNames ?? []) {
			const normalizedName = normalizeName(name);
			if (!normalizedName) continue;
			const topicId = crypto.randomUUID();
			tx.insert(topics)
				.values({
					id: topicId,
					userId: input.userId,
					name: name.trim(),
					normalizedName
				})
				.onConflictDoNothing()
				.run();
			const topic = tx.query.topics
				.findFirst({
					where: and(
						eq(topics.userId, input.userId),
						eq(topics.normalizedName, normalizedName)
					)
				})
				.sync();
			if (topic) {
				tx.insert(problemTopics)
					.values({ problemId: id, topicId: topic.id })
					.onConflictDoNothing()
					.run();
			}
		}
	});

	return problem;
}
