import { describe, expect, it } from 'vitest';
import {
	EXTERNAL_SOLVE_MATCH_GRACE_MS,
	candidateAttemptIds,
	matchExternalSolveToAttempt
} from '../../src/lib/server/services/external-solve-links';

const userId = 'user-1';
const problemId = 'problem-two-sum';

function solve(
	submittedAt: string,
	overrides: Partial<{ userId: string; problemId: string }> = {}
) {
	return {
		userId,
		problemId,
		submittedAt,
		...overrides
	};
}

function segment(
	attemptId: string,
	startedAt: string,
	endedAt: string | null,
	overrides: Partial<{ userId: string; problemId: string }> = {}
) {
	return {
		attemptId,
		userId,
		problemId,
		startedAt,
		endedAt,
		...overrides
	};
}

describe('external solve time-window matching', () => {
	const startedAt = '2026-08-11T12:00:00.000Z';
	const endedAt = '2026-08-11T12:20:00.000Z';

	it('matches the same problem inside a timer segment', () => {
		expect(
			matchExternalSolveToAttempt(solve('2026-08-11T12:10:00.000Z'), [
				segment('attempt-1', startedAt, endedAt)
			])
		).toBe('attempt-1');
	});

	it('includes the segment start and exact grace-period boundary', () => {
		expect(
			matchExternalSolveToAttempt(solve(startedAt), [
				segment('attempt-1', startedAt, endedAt)
			])
		).toBe('attempt-1');

		const graceBoundary = new Date(
			Date.parse(endedAt) + EXTERNAL_SOLVE_MATCH_GRACE_MS
		).toISOString();
		expect(
			matchExternalSolveToAttempt(solve(graceBoundary), [
				segment('attempt-1', startedAt, endedAt)
			])
		).toBe('attempt-1');
	});

	it('rejects timestamps outside the window and different problems', () => {
		expect(
			matchExternalSolveToAttempt(solve('2026-08-11T12:31:00.001Z'), [
				segment('attempt-1', startedAt, endedAt)
			])
		).toBeNull();
		expect(
			matchExternalSolveToAttempt(
				solve('2026-08-11T12:10:00.000Z', { problemId: 'problem-other' }),
				[segment('attempt-1', startedAt, endedAt)]
			)
		).toBeNull();
	});

	it('leaves overlapping timed attempts ambiguous', () => {
		const candidates = candidateAttemptIds(solve('2026-08-11T12:10:00.000Z'), [
			segment('attempt-1', startedAt, endedAt),
			segment(
				'attempt-2',
				'2026-08-11T12:05:00.000Z',
				'2026-08-11T12:15:00.000Z'
			)
		]);
		expect(candidates).toEqual(['attempt-1', 'attempt-2']);
		expect(
			matchExternalSolveToAttempt(solve('2026-08-11T12:10:00.000Z'), [
				segment('attempt-1', startedAt, endedAt),
				segment(
					'attempt-2',
					'2026-08-11T12:05:00.000Z',
					'2026-08-11T12:15:00.000Z'
				)
			])
		).toBeNull();
	});

	it('checks every timer segment for a paused and resumed attempt', () => {
		expect(
			matchExternalSolveToAttempt(solve('2026-08-11T13:05:00.000Z'), [
				segment(
					'attempt-1',
					'2026-08-11T12:00:00.000Z',
					'2026-08-11T12:10:00.000Z'
				),
				segment(
					'attempt-1',
					'2026-08-11T13:00:00.000Z',
					'2026-08-11T13:10:00.000Z'
				)
			])
		).toBe('attempt-1');
	});

	it('does not apply final-segment grace to an earlier pause gap', () => {
		expect(
			matchExternalSolveToAttempt(solve('2026-08-11T12:15:00.000Z'), [
				segment(
					'attempt-1',
					'2026-08-11T12:00:00.000Z',
					'2026-08-11T12:10:00.000Z'
				),
				segment(
					'attempt-1',
					'2026-08-11T13:00:00.000Z',
					'2026-08-11T13:10:00.000Z'
				)
			])
		).toBeNull();
	});
});
