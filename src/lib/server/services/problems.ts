import { and, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { problemTopics, problems, topics } from '$lib/server/db/schema';
import { isoNow } from '$lib/utils/dates';
import type { ProblemProvider } from '$lib/utils/providers';
import { normalizeName, titleFromSlug } from './normalize';

export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

export function canonicalProblemUrl(provider: ProblemProvider, slug: string) {
	const normalizedSlug = slug.trim().toLowerCase();
	switch (provider) {
		case 'leetcode':
			return `https://leetcode.com/problems/${normalizedSlug}/`;
		case 'neetcode':
			return `https://neetcode.io/problems/${normalizedSlug}/question`;
		case 'hackerrank':
			return `https://www.hackerrank.com/challenges/${normalizedSlug}/problem`;
		case 'other':
			throw new Error('Other providers require their original URL.');
	}
}

export function parseLeetCodeProblemUrl(input: string) {
	const url = parseHttpsUrl(input);
	if (hostnameWithoutWww(url) !== 'leetcode.com') {
		throw new Error('Use an HTTPS LeetCode problem URL.');
	}

	const parts = url.pathname.split('/').filter(Boolean);
	const problemsIndex = parts.findIndex(
		(part) => part.toLowerCase() === 'problems'
	);
	const slug = problemsIndex >= 0 ? parts[problemsIndex + 1] : undefined;
	if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
		throw new Error(
			'Use a LeetCode URL like https://leetcode.com/problems/two-sum/.'
		);
	}

	return {
		slug: slug.toLowerCase(),
		url: canonicalProblemUrl('leetcode', slug),
		title: titleFromSlug(slug.toLowerCase())
	};
}

export function parseProblemUrl(input: string) {
	const url = parseHttpsUrl(input);
	const provider = providerFromHostname(url.hostname);

	switch (provider) {
		case 'leetcode':
			return { provider, ...parseLeetCodeProblemUrl(input) };
		case 'neetcode':
			return { provider, ...parseNeetCodeProblemUrl(url) };
		case 'hackerrank':
			return { provider, ...parseHackerRankProblemUrl(url) };
		case 'other':
			return { provider, ...parseOtherProblemUrl(url) };
	}
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
	const parsed = parseProblemUrl(input.url);
	const existing = await db.query.problems.findFirst({
		where: and(eq(problems.userId, input.userId), eq(problems.url, parsed.url))
	});
	if (existing) {
		const nextTitle = input.title?.trim();
		if (nextTitle && nextTitle !== existing.title) {
			const updatedAt = isoNow();
			await db
				.update(problems)
				.set({ title: nextTitle, updatedAt })
				.where(eq(problems.id, existing.id));
			return { ...existing, title: nextTitle, updatedAt };
		}
		return existing;
	}

	const now = isoNow();
	const id = crypto.randomUUID();
	const problem = {
		id,
		userId: input.userId,
		provider: parsed.provider,
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

function parseNeetCodeProblemUrl(url: URL) {
	const slug = slugAfterSegment(url, 'problems');
	if (!slug) {
		throw new Error(
			'Use a NeetCode URL like https://neetcode.io/problems/two-sum/question.'
		);
	}
	return {
		slug,
		url: canonicalProblemUrl('neetcode', slug),
		title: titleFromSlug(slug)
	};
}

function parseHackerRankProblemUrl(url: URL) {
	const slug = slugAfterSegment(url, 'challenges');
	if (!slug) {
		throw new Error(
			'Use a HackerRank URL like https://www.hackerrank.com/challenges/solve-me-first/problem.'
		);
	}
	return {
		slug,
		url: canonicalProblemUrl('hackerrank', slug),
		title: titleFromSlug(slug)
	};
}

function parseOtherProblemUrl(url: URL) {
	const rawSlug = [...url.pathname.split('/').filter(Boolean)]
		.reverse()
		.find(
			(part) => !/^(problem|question|description|submissions?)$/i.test(part)
		);
	const slug = toSlug(rawSlug ?? hostnameWithoutWww(url).split('.')[0]);
	const pathname = url.pathname.replace(/\/+$/, '') || '/';
	return {
		slug,
		url: `${url.origin}${pathname}`,
		title: titleFromSlug(slug)
	};
}

function parseHttpsUrl(input: string) {
	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new Error('Enter a valid HTTPS problem URL.');
	}
	if (url.protocol !== 'https:') {
		throw new Error('Problem URLs must use HTTPS.');
	}
	return url;
}

function providerFromHostname(hostname: string): ProblemProvider {
	switch (hostnameWithoutWww(hostname)) {
		case 'leetcode.com':
			return 'leetcode';
		case 'neetcode.io':
			return 'neetcode';
		case 'hackerrank.com':
			return 'hackerrank';
		default:
			return 'other';
	}
}

function hostnameWithoutWww(value: string | URL) {
	const hostname = typeof value === 'string' ? value : value.hostname;
	return hostname.toLowerCase().replace(/^www\./, '');
}

function slugAfterSegment(url: URL, segment: string) {
	const parts = url.pathname.split('/').filter(Boolean);
	const index = parts.findIndex((part) => part.toLowerCase() === segment);
	const rawSlug = index >= 0 ? parts[index + 1] : undefined;
	return rawSlug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(rawSlug)
		? rawSlug.toLowerCase()
		: null;
}

function toSlug(value: string) {
	return (
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'problem'
	);
}
