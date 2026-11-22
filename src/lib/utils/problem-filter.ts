import type { ProblemDifficulty } from '$lib/server/services/problems';
import type { ProblemProvider } from './providers';

export type ProblemFilter = {
	query: string;
	provider: ProblemProvider | 'all';
	difficulty: ProblemDifficulty | 'all';
};

type FilterableProblem = {
	title: string;
	slug: string;
	provider: ProblemProvider;
	difficulty: ProblemDifficulty | null;
};

export const emptyProblemFilter = (): ProblemFilter => ({
	query: '',
	provider: 'all',
	difficulty: 'all'
});

export function matchesProblemFilter(
	problem: FilterableProblem,
	filter: ProblemFilter
) {
	if (filter.provider !== 'all' && problem.provider !== filter.provider)
		return false;
	if (filter.difficulty !== 'all' && problem.difficulty !== filter.difficulty)
		return false;
	const query = filter.query.trim().toLowerCase();
	return (
		!query ||
		problem.title.toLowerCase().includes(query) ||
		problem.slug.includes(query)
	);
}

/** Counts per value, in a stable order, for values that actually occur. */
export function countBy<T extends string>(
	values: (T | null)[],
	order: readonly T[]
) {
	return order
		.map((value) => ({
			value,
			count: values.filter((candidate) => candidate === value).length
		}))
		.filter((entry) => entry.count > 0);
}
