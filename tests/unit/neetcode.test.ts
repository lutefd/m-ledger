import { describe, expect, it } from 'vitest';
import { canonicalProblemUrl } from '../../src/lib/server/services/problems';
import {
	languageFromExtension,
	parseNeetCodeSubmissionPath,
	sourceCodeUrl
} from '../../src/lib/server/services/neetcode';

describe('NeetCode submission paths', () => {
	it('parses a supported submission and derives display metadata', () => {
		expect(
			parseNeetCodeSubmissionPath(
				'Data Structures & Algorithms/validate-parentheses/submission-0.go'
			)
		).toEqual({
			course: 'Data Structures & Algorithms',
			slug: 'validate-parentheses',
			title: 'Validate Parentheses',
			submissionIndex: 0,
			extension: 'go',
			language: 'Go',
			url: 'https://neetcode.io/problems/validate-parentheses/question'
		});
	});

	it('detects common language extensions case-insensitively', () => {
		expect(languageFromExtension('GO')).toBe('Go');
		expect(languageFromExtension('py')).toBe('Python');
		expect(languageFromExtension('tsx')).toBe('TypeScript');
		expect(languageFromExtension('txt')).toBeNull();
	});

	it('ignores unrelated paths and unsupported files', () => {
		expect(parseNeetCodeSubmissionPath('README.md')).toBeNull();
		expect(
			parseNeetCodeSubmissionPath(
				'Data Structures & Algorithms/two-sum/notes.txt'
			)
		).toBeNull();
		expect(
			parseNeetCodeSubmissionPath(
				'Data Structures & Algorithms/two-sum/submission.go'
			)
		).toBeNull();
	});

	it('keeps provider catalogs and source URLs canonical', () => {
		expect(canonicalProblemUrl('leetcode', 'two-sum')).toBe(
			'https://leetcode.com/problems/two-sum/'
		);
		expect(canonicalProblemUrl('neetcode', 'two-sum')).toBe(
			'https://neetcode.io/problems/two-sum/question'
		);
		expect(
			sourceCodeUrl(
				'lutefd/neetcode-submissions',
				'abc123',
				'Data Structures & Algorithms/two-sum/submission-0.go'
			)
		).toBe(
			'https://github.com/lutefd/neetcode-submissions/blob/abc123/Data%20Structures%20%26%20Algorithms/two-sum/submission-0.go'
		);
	});
});
