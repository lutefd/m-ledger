import { describe, expect, it } from 'vitest';
import { rankMistakeCandidates } from '../../src/lib/server/services/briefing';

describe('briefing ranking', () => {
	const now = new Date('2026-06-16T00:00:00.000Z');

	it('requires recurring and recent occurrences', () => {
		const ranked = rankMistakeCandidates(
			[
				{
					id: 'recurring',
					name: 'Boundary check',
					guardrail: null,
					occurrences: [
						{ completedAt: '2026-06-10T00:00:00.000Z', confidence: 2 },
						{ completedAt: '2026-05-01T00:00:00.000Z', confidence: 3 }
					]
				},
				{
					id: 'single',
					name: 'Single miss',
					guardrail: null,
					occurrences: [
						{ completedAt: '2026-06-11T00:00:00.000Z', confidence: 1 }
					]
				},
				{
					id: 'old',
					name: 'Old miss',
					guardrail: null,
					occurrences: [
						{ completedAt: '2026-01-01T00:00:00.000Z', confidence: 1 },
						{ completedAt: '2026-01-02T00:00:00.000Z', confidence: 1 }
					]
				}
			],
			now
		);

		expect(ranked.map((mistake) => mistake.id)).toEqual([
			'recurring',
			'single'
		]);
	});

	it('sorts by score, latest occurrence, then name', () => {
		const ranked = rankMistakeCandidates(
			[
				{
					id: 'b',
					name: 'Zulu',
					guardrail: null,
					occurrences: [
						{ completedAt: '2026-06-01T00:00:00.000Z', confidence: 3 },
						{ completedAt: '2026-05-01T00:00:00.000Z', confidence: 3 }
					]
				},
				{
					id: 'a',
					name: 'Alpha',
					guardrail: null,
					occurrences: [
						{ completedAt: '2026-06-01T00:00:00.000Z', confidence: 3 },
						{ completedAt: '2026-05-01T00:00:00.000Z', confidence: 3 }
					]
				},
				{
					id: 'high',
					name: 'Higher score',
					guardrail: null,
					occurrences: [
						{ completedAt: '2026-06-10T00:00:00.000Z', confidence: 1 },
						{ completedAt: '2026-06-02T00:00:00.000Z', confidence: 1 }
					]
				}
			],
			now
		);

		expect(ranked.map((mistake) => mistake.id)).toEqual(['high', 'a', 'b']);
	});
});
