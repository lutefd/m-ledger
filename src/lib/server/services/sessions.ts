import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	attemptMistakes,
	attemptPatterns,
	attempts,
	briefingMistakes,
	briefingRedos,
	briefings,
	mistakes,
	problems,
	sessionQueue,
	studySessions,
	timerSegments
} from '$lib/server/db/schema';
import { isoNow } from '$lib/utils/dates';
import { generateBriefing } from './briefing';

export type RecapAttemptInput = {
	attemptId: string;
	outcome: 'solved_independently' | 'solved_with_help' | 'partial' | 'stuck';
	confidence: number;
	notes?: string;
	redoDate?: string;
	mistakeIds: string[];
	patternIds: string[];
};

export async function createStudySession(
	db: Db,
	userId: string,
	problemIds: string[]
) {
	if (problemIds.length === 0) throw new Error('Choose at least one problem.');
	const owned = await db
		.select({ id: problems.id })
		.from(problems)
		.where(and(eq(problems.userId, userId), inArray(problems.id, problemIds)));
	if (owned.length !== problemIds.length)
		throw new Error('One or more problems were not found.');

	const sessionId = crypto.randomUUID();
	const now = isoNow();
	db.transaction((tx) => {
		tx.insert(studySessions)
			.values({
				id: sessionId,
				userId,
				status: 'briefing',
				startedAt: now
			})
			.run();
		tx.insert(sessionQueue)
			.values(
				problemIds.map((problemId, index) => ({
					sessionId,
					problemId,
					position: index + 1
				}))
			)
			.run();
	});
	await generateBriefing(db, userId, sessionId);
	return sessionId;
}

export async function listRecentSessions(db: Db, userId: string, limit = 10) {
	return db
		.select({
			id: studySessions.id,
			status: studySessions.status,
			startedAt: studySessions.startedAt,
			finishedAt: studySessions.finishedAt
		})
		.from(studySessions)
		.where(eq(studySessions.userId, userId))
		.orderBy(desc(studySessions.startedAt))
		.limit(limit);
}

export async function getSessionDetail(
	db: Db,
	userId: string,
	sessionId: string
) {
	const session = await db.query.studySessions.findFirst({
		where: and(
			eq(studySessions.userId, userId),
			eq(studySessions.id, sessionId)
		)
	});
	if (!session) return null;

	const queue = await db
		.select({
			position: sessionQueue.position,
			problemId: problems.id,
			title: problems.title,
			url: problems.url,
			slug: problems.slug,
			attemptId: attempts.id,
			outcome: attempts.outcome,
			confidence: attempts.confidence
		})
		.from(sessionQueue)
		.innerJoin(problems, eq(problems.id, sessionQueue.problemId))
		.leftJoin(
			attempts,
			and(
				eq(attempts.sessionId, sessionQueue.sessionId),
				eq(attempts.problemId, sessionQueue.problemId)
			)
		)
		.where(eq(sessionQueue.sessionId, sessionId))
		.orderBy(asc(sessionQueue.position));

	const briefing = await db.query.briefings.findFirst({
		where: eq(briefings.sessionId, sessionId)
	});
	const briefingMistakeRows = briefing
		? await db
				.select({
					rank: briefingMistakes.rank,
					score: briefingMistakes.score,
					occurrenceCount: briefingMistakes.occurrenceCount,
					lastOccurrence: briefingMistakes.lastOccurrence,
					averageConfidence: briefingMistakes.averageConfidence,
					name: mistakes.name,
					guardrail: mistakes.guardrail
				})
				.from(briefingMistakes)
				.innerJoin(mistakes, eq(mistakes.id, briefingMistakes.mistakeId))
				.where(eq(briefingMistakes.briefingId, briefing.id))
				.orderBy(asc(briefingMistakes.rank))
		: [];
	const briefingRedoRows = briefing
		? await db
				.select({
					rank: briefingRedos.rank,
					dueDate: briefingRedos.dueDate,
					title: problems.title,
					url: problems.url
				})
				.from(briefingRedos)
				.innerJoin(problems, eq(problems.id, briefingRedos.problemId))
				.where(eq(briefingRedos.briefingId, briefing.id))
				.orderBy(asc(briefingRedos.rank))
		: [];

	const segments = await db
		.select()
		.from(timerSegments)
		.where(eq(timerSegments.sessionId, sessionId))
		.orderBy(asc(timerSegments.startedAt));

	return {
		session,
		queue,
		briefing,
		briefingMistakes: briefingMistakeRows,
		briefingRedos: briefingRedoRows,
		segments,
		elapsedMs: elapsedMs(segments)
	};
}

export function elapsedMs(
	segments: { startedAt: string; endedAt: string | null }[],
	now = new Date()
) {
	return segments.reduce((total, segment) => {
		const end = segment.endedAt ? new Date(segment.endedAt) : now;
		return (
			total + Math.max(0, end.getTime() - new Date(segment.startedAt).getTime())
		);
	}, 0);
}

export async function acknowledgeBriefing(
	db: Db,
	userId: string,
	sessionId: string
) {
	const now = isoNow();
	db.transaction((tx) => {
		const session = tx.query.studySessions
			.findFirst({
				where: and(
					eq(studySessions.userId, userId),
					eq(studySessions.id, sessionId)
				)
			})
			.sync();
		if (!session || session.status !== 'briefing')
			throw new Error('Session is not waiting on a briefing.');
		tx.update(briefings)
			.set({ acknowledgedAt: now })
			.where(eq(briefings.sessionId, sessionId))
			.run();
		tx.update(studySessions)
			.set({ status: 'paused' })
			.where(eq(studySessions.id, sessionId))
			.run();
	});
}

export async function activateProblem(
	db: Db,
	userId: string,
	sessionId: string,
	problemId: string
) {
	const now = isoNow();
	db.transaction((tx) => {
		const session = tx.query.studySessions
			.findFirst({
				where: and(
					eq(studySessions.userId, userId),
					eq(studySessions.id, sessionId)
				)
			})
			.sync();
		if (
			!session ||
			session.status === 'completed' ||
			session.status === 'briefing'
		) {
			throw new Error('Session cannot be changed right now.');
		}
		const queued = tx.query.sessionQueue
			.findFirst({
				where: and(
					eq(sessionQueue.sessionId, sessionId),
					eq(sessionQueue.problemId, problemId)
				)
			})
			.sync();
		if (!queued) throw new Error('Problem is not in this session.');

		let attempt = tx.query.attempts
			.findFirst({
				where: and(
					eq(attempts.sessionId, sessionId),
					eq(attempts.problemId, problemId)
				)
			})
			.sync();
		if (!attempt) {
			const attemptId = crypto.randomUUID();
			tx.insert(attempts)
				.values({
					id: attemptId,
					userId,
					sessionId,
					problemId,
					createdAt: now
				})
				.run();
			attempt = tx.query.attempts
				.findFirst({
					where: eq(attempts.id, attemptId)
				})
				.sync()!;
		}

		tx.update(timerSegments)
			.set({ endedAt: now })
			.where(
				and(
					eq(timerSegments.sessionId, sessionId),
					isNull(timerSegments.endedAt)
				)
			)
			.run();
		tx.insert(timerSegments)
			.values({
				id: crypto.randomUUID(),
				userId,
				sessionId,
				attemptId: attempt.id,
				startedAt: now
			})
			.run();
		tx.update(studySessions)
			.set({ status: 'active' })
			.where(eq(studySessions.id, sessionId))
			.run();
	});
}

export async function pauseSession(db: Db, userId: string, sessionId: string) {
	const now = isoNow();
	db.transaction((tx) => {
		const session = tx.query.studySessions
			.findFirst({
				where: and(
					eq(studySessions.userId, userId),
					eq(studySessions.id, sessionId)
				)
			})
			.sync();
		if (!session || session.status === 'completed')
			throw new Error('Session cannot be paused.');
		tx.update(timerSegments)
			.set({ endedAt: now })
			.where(
				and(
					eq(timerSegments.sessionId, sessionId),
					isNull(timerSegments.endedAt)
				)
			)
			.run();
		tx.update(studySessions)
			.set({ status: 'paused' })
			.where(eq(studySessions.id, sessionId))
			.run();
	});
}

export async function completeSession(
	db: Db,
	userId: string,
	sessionId: string
) {
	const now = isoNow();
	db.transaction((tx) => {
		const session = tx.query.studySessions
			.findFirst({
				where: and(
					eq(studySessions.userId, userId),
					eq(studySessions.id, sessionId)
				)
			})
			.sync();
		if (!session || session.status === 'completed')
			throw new Error('Session cannot be completed.');
		tx.update(timerSegments)
			.set({ endedAt: now })
			.where(
				and(
					eq(timerSegments.sessionId, sessionId),
					isNull(timerSegments.endedAt)
				)
			)
			.run();
		tx.update(studySessions)
			.set({ status: 'completed', finishedAt: now })
			.where(eq(studySessions.id, sessionId))
			.run();
	});
}

export async function saveRecap(
	db: Db,
	userId: string,
	sessionId: string,
	inputs: RecapAttemptInput[]
) {
	const now = isoNow();
	db.transaction((tx) => {
		const session = tx.query.studySessions
			.findFirst({
				where: and(
					eq(studySessions.userId, userId),
					eq(studySessions.id, sessionId)
				)
			})
			.sync();
		if (!session || session.status === 'completed')
			throw new Error('Session cannot be recapped.');

		for (const input of inputs) {
			const attempt = tx.query.attempts
				.findFirst({
					where: and(
						eq(attempts.userId, userId),
						eq(attempts.sessionId, sessionId),
						eq(attempts.id, input.attemptId)
					)
				})
				.sync();
			if (!attempt) throw new Error('Attempt not found.');
			tx.update(attempts)
				.set({
					outcome: input.outcome,
					confidence: input.confidence,
					notes: input.notes?.trim() || null,
					redoDate: input.redoDate || null,
					completedAt: now
				})
				.where(eq(attempts.id, input.attemptId))
				.run();
			tx.delete(attemptMistakes)
				.where(eq(attemptMistakes.attemptId, input.attemptId))
				.run();
			tx.delete(attemptPatterns)
				.where(eq(attemptPatterns.attemptId, input.attemptId))
				.run();
			if (input.mistakeIds.length) {
				tx.insert(attemptMistakes)
					.values(
						input.mistakeIds.map((mistakeId) => ({
							attemptId: input.attemptId,
							mistakeId
						}))
					)
					.run();
			}
			if (input.patternIds.length) {
				tx.insert(attemptPatterns)
					.values(
						input.patternIds.map((patternId) => ({
							attemptId: input.attemptId,
							patternId
						}))
					)
					.run();
			}
		}

		tx.update(timerSegments)
			.set({ endedAt: now })
			.where(
				and(
					eq(timerSegments.sessionId, sessionId),
					isNull(timerSegments.endedAt)
				)
			)
			.run();
		tx.update(studySessions)
			.set({ status: 'completed', finishedAt: now })
			.where(eq(studySessions.id, sessionId))
			.run();
	});
}

export async function getTodaySnapshot(db: Db, userId: string) {
	const recent = await listRecentSessions(db, userId, 5);
	const latestBriefing = await db.query.briefings.findFirst({
		where: eq(briefings.userId, userId),
		orderBy: [desc(briefings.createdAt)]
	});
	if (!latestBriefing) return { recent, mistakes: [], redos: [] };
	const [mistakeRows, redoRows] = await Promise.all([
		db
			.select({
				rank: briefingMistakes.rank,
				occurrenceCount: briefingMistakes.occurrenceCount,
				lastOccurrence: briefingMistakes.lastOccurrence,
				name: mistakes.name,
				guardrail: mistakes.guardrail
			})
			.from(briefingMistakes)
			.innerJoin(mistakes, eq(mistakes.id, briefingMistakes.mistakeId))
			.where(eq(briefingMistakes.briefingId, latestBriefing.id))
			.orderBy(asc(briefingMistakes.rank)),
		db
			.select({
				rank: briefingRedos.rank,
				dueDate: briefingRedos.dueDate,
				title: problems.title,
				url: problems.url
			})
			.from(briefingRedos)
			.innerJoin(problems, eq(problems.id, briefingRedos.problemId))
			.where(eq(briefingRedos.briefingId, latestBriefing.id))
			.orderBy(asc(briefingRedos.rank))
	]);
	return { recent, mistakes: mistakeRows, redos: redoRows };
}

export async function getProblemHistory(
	db: Db,
	userId: string,
	problemId: string
) {
	const problem = await db.query.problems.findFirst({
		where: and(eq(problems.userId, userId), eq(problems.id, problemId))
	});
	if (!problem) return null;
	const history = await db
		.select({
			attemptId: attempts.id,
			outcome: attempts.outcome,
			confidence: attempts.confidence,
			redoDate: attempts.redoDate,
			notes: attempts.notes,
			completedAt: attempts.completedAt,
			sessionId: attempts.sessionId
		})
		.from(attempts)
		.where(and(eq(attempts.userId, userId), eq(attempts.problemId, problemId)))
		.orderBy(desc(attempts.createdAt));
	const totalMsRows = await db
		.select({
			ms: sql<number>`sum((julianday(ended_at) - julianday(started_at)) * 86400000)`
		})
		.from(timerSegments)
		.innerJoin(attempts, eq(attempts.id, timerSegments.attemptId))
		.where(
			and(
				eq(attempts.userId, userId),
				eq(attempts.problemId, problemId),
				sql`${timerSegments.endedAt} is not null`
			)
		);
	return {
		problem,
		history,
		totalMs: Math.round(Number(totalMsRows[0]?.ms ?? 0))
	};
}

export async function getMistakeHistory(
	db: Db,
	userId: string,
	mistakeId: string
) {
	const mistake = await db.query.mistakes.findFirst({
		where: and(eq(mistakes.userId, userId), eq(mistakes.id, mistakeId))
	});
	if (!mistake) return null;
	const history = await db
		.select({
			attemptId: attempts.id,
			problemTitle: problems.title,
			problemId: problems.id,
			confidence: attempts.confidence,
			completedAt: attempts.completedAt,
			outcome: attempts.outcome
		})
		.from(attemptMistakes)
		.innerJoin(attempts, eq(attempts.id, attemptMistakes.attemptId))
		.innerJoin(problems, eq(problems.id, attempts.problemId))
		.where(
			and(eq(attemptMistakes.mistakeId, mistakeId), eq(attempts.userId, userId))
		)
		.orderBy(desc(attempts.completedAt));
	return { mistake, history };
}
