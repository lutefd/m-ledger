import { and, asc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	attemptMistakes,
	attemptPatterns,
	attempts,
	dailyPlans,
	mistakes,
	patterns,
	problems,
	studySessions,
	timerSegments
} from '$lib/server/db/schema';

export class AttemptsFeedError extends Error {
	constructor(
		message: string,
		readonly status: number = 400
	) {
		super(message);
		this.name = 'AttemptsFeedError';
	}
}

export function parseAttemptsSince(value: string | null) {
	if (!value) {
		throw new AttemptsFeedError('since query param is required (ISO-8601).');
	}
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) {
		throw new AttemptsFeedError('since must be a valid ISO-8601 timestamp.');
	}
	return parsed.toISOString();
}

export async function listCompletedAttemptsSince(
	db: Db,
	userId: string,
	sinceIso: string
) {
	const rows = await db
		.select({
			id: attempts.id,
			sessionId: attempts.sessionId,
			sessionName: studySessions.name,
			outcome: attempts.outcome,
			confidence: attempts.confidence,
			completedAt: attempts.completedAt,
			slug: problems.slug,
			url: problems.url,
			title: problems.title,
			problemId: problems.id,
			elapsedMs: sql<number>`coalesce(sum((julianday(${timerSegments.endedAt}) - julianday(${timerSegments.startedAt})) * 86400000), 0)`,
			fromBotPlan: sql<number>`exists (
				select 1 from ${dailyPlans}
				where ${dailyPlans.startedSessionId} = ${attempts.sessionId}
					and ${dailyPlans.userId} = ${attempts.userId}
			)`
		})
		.from(attempts)
		.innerJoin(problems, eq(problems.id, attempts.problemId))
		.innerJoin(studySessions, eq(studySessions.id, attempts.sessionId))
		.leftJoin(timerSegments, eq(timerSegments.attemptId, attempts.id))
		.where(
			and(
				eq(attempts.userId, userId),
				isNotNull(attempts.completedAt),
				gt(attempts.completedAt, sinceIso)
			)
		)
		.groupBy(attempts.id)
		.orderBy(asc(attempts.completedAt), asc(attempts.id));

	const attemptIds = rows.map((row) => row.id);
	const mistakeRows =
		attemptIds.length === 0
			? []
			: await db
					.select({
						attemptId: attemptMistakes.attemptId,
						id: mistakes.id,
						name: mistakes.name
					})
					.from(attemptMistakes)
					.innerJoin(mistakes, eq(mistakes.id, attemptMistakes.mistakeId))
					.where(
						and(
							eq(mistakes.userId, userId),
							inArray(attemptMistakes.attemptId, attemptIds)
						)
					);

	const patternRows =
		attemptIds.length === 0
			? []
			: await db
					.select({
						attemptId: attemptPatterns.attemptId,
						id: patterns.id,
						name: patterns.name
					})
					.from(attemptPatterns)
					.innerJoin(patterns, eq(patterns.id, attemptPatterns.patternId))
					.where(
						and(
							eq(patterns.userId, userId),
							inArray(attemptPatterns.attemptId, attemptIds)
						)
					);

	const mistakesByAttempt = new Map<string, { id: string; name: string }[]>();
	for (const row of mistakeRows) {
		const list = mistakesByAttempt.get(row.attemptId) ?? [];
		list.push({ id: row.id, name: row.name });
		mistakesByAttempt.set(row.attemptId, list);
	}
	const patternsByAttempt = new Map<string, { id: string; name: string }[]>();
	for (const row of patternRows) {
		const list = patternsByAttempt.get(row.attemptId) ?? [];
		list.push({ id: row.id, name: row.name });
		patternsByAttempt.set(row.attemptId, list);
	}

	return {
		since: sinceIso,
		attempts: rows.map((row) => ({
			id: row.id,
			sessionId: row.sessionId,
			sessionName: row.sessionName,
			problemId: row.problemId,
			slug: row.slug,
			url: row.url,
			title: row.title,
			outcome: row.outcome,
			confidence: row.confidence,
			elapsedMs: Math.round(Number(row.elapsedMs ?? 0)),
			completedAt: row.completedAt!,
			fromBotPlan: Boolean(row.fromBotPlan),
			mistakes: mistakesByAttempt.get(row.id) ?? [],
			patterns: patternsByAttempt.get(row.id) ?? []
		}))
	};
}
