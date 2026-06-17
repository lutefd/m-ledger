import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	attemptMistakes,
	attemptPatterns,
	attempts,
	briefingMistakes,
	briefingRedos,
	briefings,
	mistakes,
	patterns,
	problems,
	sessionQueue,
	studySessions,
	timerSegments
} from '$lib/server/db/schema';
import { isoNow } from '$lib/utils/dates';
import { recapSchema, type RecapInput } from '$lib/server/validation/sessions';
import { serializeRichTextDocument } from '$lib/server/validation/rich-text';
import { generateBriefing, getBriefingPreview } from './briefing';
import { createProblem } from './problems';

export type RecapAttemptInput = RecapInput[number];

export async function createStudySession(
	db: Db,
	userId: string,
	problemIds: string[]
) {
	const openSession = await getUnfinishedSession(db, userId);
	if (openSession) return openSession.id;
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

export async function getUnfinishedSession(db: Db, userId: string) {
	return db.query.studySessions.findFirst({
		where: and(
			eq(studySessions.userId, userId),
			inArray(studySessions.status, ['briefing', 'active', 'paused'])
		),
		orderBy: [desc(studySessions.startedAt)]
	});
}

export async function getOpenSessionSummary(db: Db, userId: string) {
	const session = await getUnfinishedSession(db, userId);
	if (!session) return null;
	const openSegment = await db
		.select({
			startedAt: timerSegments.startedAt,
			attemptId: timerSegments.attemptId,
			title: problems.title
		})
		.from(timerSegments)
		.leftJoin(attempts, eq(attempts.id, timerSegments.attemptId))
		.leftJoin(problems, eq(problems.id, attempts.problemId))
		.where(
			and(
				eq(timerSegments.sessionId, session.id),
				isNull(timerSegments.endedAt)
			)
		)
		.limit(1);
	const segments = await db
		.select({
			startedAt: timerSegments.startedAt,
			endedAt: timerSegments.endedAt
		})
		.from(timerSegments)
		.where(eq(timerSegments.sessionId, session.id));
	return {
		id: session.id,
		status: session.status,
		currentAttemptId: openSegment[0]?.attemptId ?? null,
		currentProblemTitle: openSegment[0]?.title ?? null,
		elapsedMs: elapsedMs(segments),
		openSegmentStartedAt: openSegment[0]?.startedAt ?? null
	};
}

export async function listRecentSessions(db: Db, userId: string, limit = 10) {
	const rows = await db
		.select({
			id: studySessions.id,
			status: studySessions.status,
			startedAt: studySessions.startedAt,
			finishedAt: studySessions.finishedAt,
			elapsedMs: sql<number>`coalesce(sum((julianday(${timerSegments.endedAt}) - julianday(${timerSegments.startedAt})) * 86400000), 0)`
		})
		.from(studySessions)
		.leftJoin(timerSegments, eq(timerSegments.sessionId, studySessions.id))
		.where(eq(studySessions.userId, userId))
		.groupBy(studySessions.id)
		.orderBy(desc(studySessions.startedAt))
		.limit(limit);
	return rows.map((row) => ({
		...row,
		elapsedMs: Math.round(Number(row.elapsedMs ?? 0))
	}));
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
			confidence: attempts.confidence,
			notesDocument: attempts.notesDocument
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

	const elapsedByAttempt = elapsedMsByAttempt(segments);
	return {
		session,
		queue: queue.map((item) => ({
			...item,
			elapsedMs: item.attemptId
				? (elapsedByAttempt.get(item.attemptId) ?? 0)
				: 0
		})),
		briefing,
		briefingMistakes: briefingMistakeRows,
		briefingRedos: briefingRedoRows,
		segments,
		elapsedMs: elapsedMs(segments)
	};
}

function elapsedMsByAttempt(
	segments: {
		attemptId: string | null;
		startedAt: string;
		endedAt: string | null;
	}[],
	now = new Date()
) {
	const result = new Map<string, number>();
	for (const segment of segments) {
		if (!segment.attemptId) continue;
		const end = segment.endedAt ? new Date(segment.endedAt) : now;
		const duration = Math.max(
			0,
			end.getTime() - new Date(segment.startedAt).getTime()
		);
		result.set(
			segment.attemptId,
			(result.get(segment.attemptId) ?? 0) + duration
		);
	}
	return result;
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
		if (
			!session ||
			session.status === 'briefing' ||
			session.status === 'completed'
		)
			throw new Error('Session cannot be paused.');
		if (session.status === 'paused') return;
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

export async function enterSessionRecap(
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
		if (
			!session ||
			session.status === 'briefing' ||
			session.status === 'completed'
		) {
			throw new Error('Session cannot enter recap.');
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
			.set({ status: 'paused' })
			.where(eq(studySessions.id, sessionId))
			.run();
	});
}

export async function updateSessionNotes(
	db: Db,
	userId: string,
	sessionId: string,
	document: unknown
) {
	const notesDocument = serializeRichTextDocument(document, 'notebook');
	await db
		.update(studySessions)
		.set({ notesDocument })
		.where(
			and(
				eq(studySessions.userId, userId),
				eq(studySessions.id, sessionId),
				ne(studySessions.status, 'completed')
			)
		);
}

export async function addProblemToSession(
	db: Db,
	userId: string,
	sessionId: string,
	problemId: string
) {
	return db.transaction((tx) => {
		const session = tx.query.studySessions
			.findFirst({
				where: and(
					eq(studySessions.userId, userId),
					eq(studySessions.id, sessionId)
				)
			})
			.sync();
		if (!session || session.status === 'completed') {
			throw new Error('Session is not open.');
		}
		const problem = tx.query.problems
			.findFirst({
				where: and(eq(problems.userId, userId), eq(problems.id, problemId))
			})
			.sync();
		if (!problem) throw new Error('Problem was not found.');
		const existing = tx.query.sessionQueue
			.findFirst({
				where: and(
					eq(sessionQueue.sessionId, sessionId),
					eq(sessionQueue.problemId, problemId)
				)
			})
			.sync();
		if (existing) return existing;
		const positionRow = tx
			.select({
				position: sql<number>`coalesce(max(${sessionQueue.position}), 0) + 1`
			})
			.from(sessionQueue)
			.where(eq(sessionQueue.sessionId, sessionId))
			.get();
		const queueItem = {
			sessionId,
			problemId,
			position: Number(positionRow?.position ?? 1)
		};
		tx.insert(sessionQueue).values(queueItem).run();
		return queueItem;
	});
}

export async function createProblemAndAddToSession(
	db: Db,
	userId: string,
	sessionId: string,
	url: string
) {
	const problem = await createProblem(db, { userId, url });
	return addProblemToSession(db, userId, sessionId, problem.id);
}

export async function deleteStudySession(
	db: Db,
	userId: string,
	sessionId: string
) {
	await db
		.delete(studySessions)
		.where(
			and(eq(studySessions.userId, userId), eq(studySessions.id, sessionId))
		);
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
	const parsedInputs = recapSchema.parse(inputs);
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

		for (const input of parsedInputs) {
			const mistakeIds = [...new Set(input.mistakeIds)];
			const patternIds = [...new Set(input.patternIds)];
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
			if (mistakeIds.length) {
				const ownedMistakes = tx
					.select({ id: mistakes.id })
					.from(mistakes)
					.where(
						and(eq(mistakes.userId, userId), inArray(mistakes.id, mistakeIds))
					)
					.all();
				if (ownedMistakes.length !== mistakeIds.length)
					throw new Error('One or more mistakes were not found.');
			}
			if (patternIds.length) {
				const ownedPatterns = tx
					.select({ id: patterns.id })
					.from(patterns)
					.where(
						and(eq(patterns.userId, userId), inArray(patterns.id, patternIds))
					)
					.all();
				if (ownedPatterns.length !== patternIds.length)
					throw new Error('One or more patterns were not found.');
			}
			tx.update(attempts)
				.set({
					outcome: input.outcome,
					confidence: input.confidence,
					notesDocument: serializeRichTextDocument(
						input.notesDocument,
						'recap'
					),
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
			if (mistakeIds.length) {
				tx.insert(attemptMistakes)
					.values(
						mistakeIds.map((mistakeId) => ({
							attemptId: input.attemptId,
							mistakeId
						}))
					)
					.run();
			}
			if (patternIds.length) {
				tx.insert(attemptPatterns)
					.values(
						patternIds.map((patternId) => ({
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
	const preview = await getBriefingPreview(db, userId);
	return { recent, mistakes: preview.mistakes, redos: preview.redos };
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
			notesDocument: attempts.notesDocument,
			completedAt: attempts.completedAt,
			sessionId: attempts.sessionId,
			elapsedMs: sql<number>`coalesce(sum((julianday(${timerSegments.endedAt}) - julianday(${timerSegments.startedAt})) * 86400000), 0)`
		})
		.from(attempts)
		.leftJoin(timerSegments, eq(timerSegments.attemptId, attempts.id))
		.where(and(eq(attempts.userId, userId), eq(attempts.problemId, problemId)))
		.groupBy(attempts.id)
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
