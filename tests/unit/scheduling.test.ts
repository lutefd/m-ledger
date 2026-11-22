import { describe, expect, it } from 'vitest';
import { suggestRedoDate } from '../../src/lib/server/services/scheduling';

describe('redo scheduling', () => {
	const completedAt = new Date('2026-06-16T12:00:00.000Z');

	it.each([
		[1, '2026-06-17'],
		[2, '2026-06-19'],
		[3, '2026-06-23'],
		[4, '2026-06-30'],
		[5, '2026-07-16']
	])('maps confidence %i to the expected redo date', (confidence, expected) => {
		expect(suggestRedoDate(confidence, completedAt)).toBe(expected);
	});

	it('anchors a Date to the America/Sao_Paulo calendar day', () => {
		// 23:30 on June 10 in Sao Paulo is already June 11 UTC.
		const lateEvening = new Date('2026-06-11T02:30:00.000Z');
		expect(suggestRedoDate(1, lateEvening)).toBe('2026-06-11');
	});
});
