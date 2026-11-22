export type ProblemProvider = 'leetcode' | 'neetcode' | 'hackerrank' | 'other';

export const problemProviderLabels: Record<ProblemProvider, string> = {
	leetcode: 'LeetCode',
	neetcode: 'NeetCode',
	hackerrank: 'HackerRank',
	other: 'Other'
};

export function problemProviderLabel(provider: ProblemProvider) {
	return problemProviderLabels[provider];
}
