import { z } from 'zod';
import type { ProblemDifficulty } from './problems';

export type LeetCodeMetadata = {
	title: string;
	difficulty: ProblemDifficulty;
	topics: string[];
};

export type LeetCodeMetadataLookup = (
	slug: string
) => Promise<LeetCodeMetadata | null>;

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const LOOKUP_TIMEOUT_MS = 4000;

const QUERY = `query questionMetadata($titleSlug: String!) {
	question(titleSlug: $titleSlug) {
		title
		difficulty
		topicTags { name }
	}
}`;

const responseSchema = z.object({
	data: z.object({
		question: z
			.object({
				title: z.string().min(1),
				difficulty: z.enum(['Easy', 'Medium', 'Hard']),
				topicTags: z.array(z.object({ name: z.string().min(1) })).default([])
			})
			.nullable()
	})
});

/**
 * Best-effort lookup of a LeetCode problem's title, difficulty and topics.
 * Returns null when LeetCode is unreachable, slow, or does not know the slug,
 * so callers can always fall back to what the user typed.
 */
export async function lookupLeetCodeMetadata(
	slug: string,
	fetchImpl: typeof fetch = fetch
): Promise<LeetCodeMetadata | null> {
	try {
		const response = await fetchImpl(LEETCODE_GRAPHQL_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				referer: `https://leetcode.com/problems/${slug}/`
			},
			body: JSON.stringify({ query: QUERY, variables: { titleSlug: slug } }),
			signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS)
		});
		if (!response.ok) return null;
		const parsed = responseSchema.safeParse(await response.json());
		const question = parsed.success ? parsed.data.data.question : null;
		if (!question) return null;
		return {
			title: question.title,
			difficulty: question.difficulty.toLowerCase() as ProblemDifficulty,
			topics: question.topicTags.map((tag) => tag.name)
		};
	} catch {
		return null;
	}
}
