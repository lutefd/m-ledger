import { describe, expect, it } from 'vitest';
import { parseLeetCodeProblemUrl } from '../../src/lib/server/services/problems';

describe('LeetCode problem URL parsing', () => {
	it('canonicalizes a problem URL and derives a title', () => {
		expect(
			parseLeetCodeProblemUrl(
				'https://leetcode.com/problems/two-sum/description/?env=foo#bar'
			)
		).toEqual({
			slug: 'two-sum',
			url: 'https://leetcode.com/problems/two-sum/',
			title: 'Two Sum'
		});
	});

	it('supports locale prefixes', () => {
		expect(
			parseLeetCodeProblemUrl(
				'https://leetcode.com/en/problems/longest-valid-parentheses/submissions/'
			).url
		).toBe('https://leetcode.com/problems/longest-valid-parentheses/');
	});

	it('rejects non-LeetCode and non-HTTPS URLs', () => {
		expect(() =>
			parseLeetCodeProblemUrl('http://leetcode.com/problems/two-sum/')
		).toThrow();
		expect(() =>
			parseLeetCodeProblemUrl('https://example.com/problems/two-sum/')
		).toThrow();
	});
});
