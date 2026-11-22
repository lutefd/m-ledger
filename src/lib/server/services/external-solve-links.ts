import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	attempts,
	externalSolves,
	externalSolveLinks,
	problems,
	timerSegments
} from '$lib/server/db/schema';
import { isoNow } from '$lib/utils/dates';

export const EXTERNAL_SOLVE_MATCH_GRACE_MS = 10 * 60 * 1000;

export type ExternalSolveMatchMethod = 'time_window' | 'manual';
export type ExternalSolveMatchConfidence = 'high' | 'medium' | 'low';

export interface MatchableExternalSolve {
	userId: string;
	problemId: string;
	submittedAt: string;
}

export interface MatchableTimerSegment {
	attemptId: string;
	userId: string;
	problemId: string;
	startedAt: string;
	endedAt: string | null;
}

/**
 * Return the distinct attempts whose own timer segment contains the external
 * solve timestamp, including the deliberately narrow post-segment grace.
 */
export function candidateAttemptIds(
	externalSolve: MatchableExternalSolve,
	segments: MatchableTimerSegment[],
	now: Date | string | number = Date.now()
) {
	const submittedAt = timestampMs(externalSolve.submittedAt);
	if (submittedAt === null) return [];

	const nowMs = toTimestampMs(now);
	const candidates = new Set<string>();
	const segmentsByAttempt = new Map<string, MatchableTimerSegment[]>();
	for (const segment of segments) {
		if (
			segment.userId !== externalSolve.userId ||
			segment.problemId !== externalSolve.problemId
		)
			continue;
		const attemptSegments = segmentsByAttempt.get(segment.attemptId) ?? [];
		attemptSegments.push(segment);
		segmentsByAttempt.set(segment.attemptId, attemptSegments);
	}

	for (const [attemptId, attemptSegments] of segmentsByAttempt) {
		const finalSegment = [...attemptSegments].sort(
			(left, right) =>
				(timestampMs(right.startedAt) ?? 0) - (timestampMs(left.startedAt) ?? 0)
		)[0];
		for (const segment of attemptSegments) {
			const startedAt = timestampMs(segment.startedAt);
			if (startedAt === null || submittedAt < startedAt) continue;

			const endedAt = segment.endedAt ? timestampMs(segment.endedAt) : nowMs;
			if (endedAt === null) continue;
			if (submittedAt <= endedAt) {
				candidates.add(attemptId);
				continue;
			}
			if (
				segment === finalSegment &&
				submittedAt <= endedAt + EXTERNAL_SOLVE_MATCH_GRACE_MS
			) {
				candidates.add(attemptId);
			}
		}
	}

	return [...candidates].sort();
}

/**
 * Match only a single plausible attempt. Overlapping candidate attempts are
 * intentionally left unlinked instead of being guessed.
 */
export function matchExternalSolveToAttempt(
	externalSolve: MatchableExternalSolve,
	segments: MatchableTimerSegment[],
	now: Date | string | number = Date.now()
) {
	const candidates = candidateAttemptIds(externalSolve, segments, now);
	return candidates.length === 1 ? candidates[0] : null;
}

export function isExternalSolveTimestampInSegment(
	submittedAt: string,
	segment: Pick<MatchableTimerSegment, 'startedAt' | 'endedAt'>,
	now: Date | string | number = Date.now()
) {
	return (
		candidateAttemptIds(
			{ userId: '', problemId: '', submittedAt },
			[
				{
					attemptId: 'segment',
					userId: '',
					problemId: '',
					...segment
				}
			],
			now
		).length === 1
	);
}

/**
 * Reconcile automatic links for a set of imported external solves. Manual
 * links are left untouched so a future manual-link flow remains safe.
 */
export function reconcileExternalSolveLinks(
	db: Db,
	externalSolveIds: string[],
	now: Date | string | number = Date.now()
) {
	const ids = [...new Set(externalSolveIds)];
	if (ids.length === 0) return { linked: 0, unlinked: 0, ambiguous: 0 };

	return db.transaction((tx) => {
		let linked = 0;
		let unlinked = 0;
		let ambiguous = 0;

		for (const externalSolveId of ids) {
			const solve = tx.query.externalSolves
				.findFirst({ where: eq(externalSolves.id, externalSolveId) })
				.sync();
			if (!solve) continue;

			const existingLink = tx.query.externalSolveLinks
				.findFirst({
					where: eq(externalSolveLinks.externalSolveId, externalSolveId)
				})
				.sync();
			if (existingLink?.method === 'manual') continue;

			const segmentRows = tx
				.select({
					attemptId: timerSegments.attemptId,
					userId: attempts.userId,
					problemId: attempts.problemId,
					startedAt: timerSegments.startedAt,
					endedAt: timerSegments.endedAt
				})
				.from(timerSegments)
				.innerJoin(attempts, eq(attempts.id, timerSegments.attemptId))
				.where(
					and(
						eq(attempts.userId, solve.userId),
						eq(attempts.problemId, solve.problemId)
					)
				)
				.orderBy(asc(timerSegments.startedAt))
				.all()
				.filter(
					(row): row is typeof row & { attemptId: string } =>
						row.attemptId !== null
				);
			const match = matchExternalSolveToAttempt(
				{
					userId: solve.userId,
					problemId: solve.problemId,
					submittedAt: solve.submittedAt
				},
				segmentRows,
				now
			);
			const candidates = candidateAttemptIds(
				{
					userId: solve.userId,
					problemId: solve.problemId,
					submittedAt: solve.submittedAt
				},
				segmentRows,
				now
			);

			if (match) {
				if (existingLink) {
					tx.update(externalSolveLinks)
						.set({
							attemptId: match,
							method: 'time_window',
							confidence: 'high'
						})
						.where(eq(externalSolveLinks.id, existingLink.id))
						.run();
				} else {
					tx.insert(externalSolveLinks)
						.values({
							id: crypto.randomUUID(),
							externalSolveId,
							attemptId: match,
							method: 'time_window',
							confidence: 'high',
							createdAt: isoNow()
						})
						.run();
				}
				linked += 1;
				continue;
			}

			if (existingLink) {
				tx.delete(externalSolveLinks)
					.where(eq(externalSolveLinks.id, existingLink.id))
					.run();
				unlinked += 1;
			}
			if (candidates.length > 1) ambiguous += 1;
		}

		return { linked, unlinked, ambiguous };
	});
}

export function reconcileExternalSolveLinksForAttempts(
	db: Db,
	attemptIds: string[],
	now: Date | string | number = Date.now()
) {
	const ids = [...new Set(attemptIds)];
	if (ids.length === 0) return { linked: 0, unlinked: 0, ambiguous: 0 };

	const solves = db
		.select({ id: externalSolves.id })
		.from(externalSolves)
		.innerJoin(attempts, eq(attempts.problemId, externalSolves.problemId))
		.where(
			and(inArray(attempts.id, ids), eq(attempts.userId, externalSolves.userId))
		)
		.all();
	return reconcileExternalSolveLinks(
		db,
		solves.map((solve) => solve.id),
		now
	);
}

/**
 * Idempotent full scan used by the migration/backfill command and by tests.
 * Existing manual links remain authoritative.
 */
export function backfillExternalSolveLinks(
	db: Db,
	userId?: string,
	now: Date | string | number = Date.now()
) {
	const solves = db
		.select({ id: externalSolves.id })
		.from(externalSolves)
		.innerJoin(problems, eq(problems.id, externalSolves.problemId))
		.where(userId ? eq(externalSolves.userId, userId) : undefined)
		.all();
	return reconcileExternalSolveLinks(
		db,
		solves.map((solve) => solve.id),
		now
	);
}

function timestampMs(value: string) {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function toTimestampMs(value: Date | string | number) {
	if (value instanceof Date) return value.getTime();
	if (typeof value === 'number') return value;
	return timestampMs(value) ?? Date.now();
}
