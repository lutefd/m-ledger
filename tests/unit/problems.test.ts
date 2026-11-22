import { describe, expect, it } from 'vitest';
import {
	parseLeetCodeProblemUrl,
	parseProblemUrl
} from '../../src/lib/server/services/problems';

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

describe('problem provider detection', () => {
	it('recognizes and canonicalizes supported providers', () => {
		expect(
			parseProblemUrl(
				'https://WWW.LeetCode.com/PROBLEMS/Two-Sum/description/?env=foo#bar'
			)
		).toMatchObject({
			provider: 'leetcode',
			slug: 'two-sum',
			url: 'https://leetcode.com/problems/two-sum/'
		});
		expect(
			parseProblemUrl('https://www.neetcode.io/problems/TWO-SUM/?source=github')
		).toMatchObject({
			provider: 'neetcode',
			slug: 'two-sum',
			url: 'https://neetcode.io/problems/two-sum/question'
		});
		expect(
			parseProblemUrl(
				'https://www.hackerrank.com/challenges/solve-me-first/problem'
			)
		).toMatchObject({
			provider: 'hackerrank',
			slug: 'solve-me-first',
			url: 'https://www.hackerrank.com/challenges/solve-me-first/problem'
		});
	});

	it('uses Other for valid HTTPS practice sites it does not know', () => {
		expect(
			parseProblemUrl('https://example.com/challenges/two_sum')
		).toMatchObject({
			provider: 'other',
			slug: 'two-sum',
			title: 'Two Sum'
		});
	});
});
