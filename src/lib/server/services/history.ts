import { asc, desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	attempts,
	externalSolves,
	externalSolveLinks,
	problems,
	timerSegments
} from '$lib/server/db/schema';

export async function listHistory(db: Db, userId: string, limit = 100) {
	const attemptRows = await db
		.select({
			attemptId: attempts.id,
			problemId: problems.id,
			problemTitle: problems.title,
			problemUrl: problems.url,
			provider: problems.provider,
			outcome: attempts.outcome,
			confidence: attempts.confidence,
			notesDocument: attempts.notesDocument,
			createdAt: attempts.createdAt,
			completedAt: attempts.completedAt,
			redoDate: attempts.redoDate,
			sessionId: attempts.sessionId
		})
		.from(attempts)
		.innerJoin(problems, eq(problems.id, attempts.problemId))
		.where(eq(attempts.userId, userId))
		.orderBy(desc(attempts.createdAt));

	const segmentRows = await db
		.select({
			attemptId: timerSegments.attemptId,
			startedAt: timerSegments.startedAt,
			endedAt: timerSegments.endedAt
		})
		.from(timerSegments)
		.innerJoin(attempts, eq(attempts.id, timerSegments.attemptId))
		.where(eq(attempts.userId, userId))
		.orderBy(asc(timerSegments.startedAt));

	const elapsedByAttempt = new Map<string, number>();
	for (const segment of segmentRows) {
		if (!segment.attemptId) continue;
		const end = segment.endedAt ? Date.parse(segment.endedAt) : Date.now();
		const start = Date.parse(segment.startedAt);
		if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
		const elapsed = Math.max(0, end - start);
		elapsedByAttempt.set(
			segment.attemptId,
			(elapsedByAttempt.get(segment.attemptId) ?? 0) + elapsed
		);
	}

	const externalRows = await db
		.select({
			externalSolveId: externalSolves.id,
			problemId: problems.id,
			problemTitle: problems.title,
			problemUrl: problems.url,
			provider: problems.provider,
			submissionPath: externalSolves.submissionPath,
			language: externalSolves.language,
			commitSha: externalSolves.commitSha,
			submittedAt: externalSolves.submittedAt,
			sourceCodeUrl: externalSolves.sourceCodeUrl,
			linkedAttemptId: externalSolveLinks.attemptId
		})
		.from(externalSolves)
		.innerJoin(problems, eq(problems.id, externalSolves.problemId))
		.leftJoin(
			externalSolveLinks,
			eq(externalSolveLinks.externalSolveId, externalSolves.id)
		)
		.where(eq(externalSolves.userId, userId))
		.orderBy(desc(externalSolves.submittedAt));

	const timedAttempts = new Map(
		attemptRows.map((attempt) => [
			attempt.attemptId,
			{
				...attempt,
				elapsedMs: Math.round(elapsedByAttempt.get(attempt.attemptId) ?? 0)
			}
		])
	);
	const usedAttemptIds = new Set<string>();
	const items = [];

	for (const externalSolve of externalRows) {
		const timedAttempt = externalSolve.linkedAttemptId
			? timedAttempts.get(externalSolve.linkedAttemptId)
			: undefined;
		if (timedAttempt) usedAttemptIds.add(timedAttempt.attemptId);
		items.push({
			id: `external:${externalSolve.externalSolveId}`,
			activityAt: externalSolve.submittedAt,
			problemId: externalSolve.problemId,
			problemTitle: externalSolve.problemTitle,
			problemUrl: externalSolve.problemUrl,
			provider: externalSolve.provider,
			externalSolve: {
				id: externalSolve.externalSolveId,
				submissionPath: externalSolve.submissionPath,
				language: externalSolve.language,
				commitSha: externalSolve.commitSha,
				submittedAt: externalSolve.submittedAt,
				sourceCodeUrl: externalSolve.sourceCodeUrl
			},
			timedAttempt: timedAttempt ?? null
		});
	}

	for (const timedAttempt of timedAttempts.values()) {
		if (usedAttemptIds.has(timedAttempt.attemptId)) continue;
		items.push({
			id: `attempt:${timedAttempt.attemptId}`,
			activityAt: timedAttempt.completedAt ?? timedAttempt.createdAt,
			problemId: timedAttempt.problemId,
			problemTitle: timedAttempt.problemTitle,
			problemUrl: timedAttempt.problemUrl,
			provider: timedAttempt.provider,
			externalSolve: null,
			timedAttempt
		});
	}

	return items
		.sort(
			(left, right) =>
				dateValue(right.activityAt) - dateValue(left.activityAt) ||
				left.id.localeCompare(right.id)
		)
		.slice(0, limit);
}

export type HistoryItem = Awaited<ReturnType<typeof listHistory>>[number];

function dateValue(value: string) {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}
