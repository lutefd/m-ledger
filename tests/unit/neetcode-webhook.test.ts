import { describe, expect, it } from 'vitest';
import {
	submissionsFromNeetCodePush,
	validateNeetCodePush
} from '../../src/lib/server/services/neetcode';

const repository = 'lutefd/neetcode-submissions';

function payload(overrides: Record<string, unknown> = {}) {
	return {
		repository: {
			full_name: repository,
			default_branch: 'main'
		},
		ref: 'refs/heads/main',
		commits: [
			{
				id: 'commit-1',
				committer: { date: '2026-08-11T12:00:00.000Z' },
				added: [
					'Data Structures & Algorithms/two-sum/submission-0.go',
					'Data Structures & Algorithms/two-sum/submission-1.go',
					'README.md'
				]
			}
		],
		...overrides
	};
}

describe('NeetCode push payloads', () => {
	it('rejects pushes from another repository or branch', () => {
		expect(
			validateNeetCodePush(
				payload({
					repository: { full_name: 'someone/else', default_branch: 'main' }
				}),
				repository
			)
		).toEqual({ accepted: false, reason: 'repository' });
		expect(
			validateNeetCodePush(payload({ ref: 'refs/heads/feature' }), repository)
		).toEqual({ accepted: false, reason: 'branch' });
	});

	it('imports only newly added supported submission files', () => {
		expect(submissionsFromNeetCodePush(payload(), repository)).toEqual([
			{
				repository,
				path: 'Data Structures & Algorithms/two-sum/submission-0.go',
				commitSha: 'commit-1',
				submittedAt: '2026-08-11T12:00:00.000Z',
				sourceCodeUrl:
					'https://github.com/lutefd/neetcode-submissions/blob/commit-1/Data%20Structures%20%26%20Algorithms/two-sum/submission-0.go'
			},
			{
				repository,
				path: 'Data Structures & Algorithms/two-sum/submission-1.go',
				commitSha: 'commit-1',
				submittedAt: '2026-08-11T12:00:00.000Z',
				sourceCodeUrl:
					'https://github.com/lutefd/neetcode-submissions/blob/commit-1/Data%20Structures%20%26%20Algorithms/two-sum/submission-1.go'
			}
		]);
	});
});
