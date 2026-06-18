import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	attemptMistakes,
	attemptPatterns,
	attempts,
	mistakes,
	patterns,
	problems,
	timerSegments
} from '$lib/server/db/schema';
import { addDaysToDateOnly, dateOnly, isoNow } from '$lib/utils/dates';
import { getBriefingPreview } from './briefing';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function defaultWeeklyExportStart(now = new Date()) {
	const start = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	);
	const day = start.getUTCDay();
	const daysSinceMonday = (day + 6) % 7;
	start.setUTCDate(start.getUTCDate() - daysSinceMonday);
	return dateOnly(start);
}

export function parseWeeklyExportStart(value: string | null, now = new Date()) {
	if (!value) return defaultWeeklyExportStart(now);
	if (!DATE_ONLY_RE.test(value)) {
		throw new Error('weekStart must use YYYY-MM-DD.');
	}
	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || dateOnly(parsed) !== value) {
		throw new Error('weekStart must be a valid date.');
	}
	return value;
}

export async function getWeeklyExport(
	db: Db,
	userId: string,
	options: { weekStart?: string | null; now?: Date } = {}
) {
	const now = options.now ?? new Date();
	const weekStart = parseWeeklyExportStart(options.weekStart ?? null, now);
	const weekEnd = addDaysToDateOnly(weekStart, 6);
	const nextWeekStart = addDaysToDateOnly(weekStart, 7);
	const completedFrom = `${weekStart}T00:00:00.000Z`;
	const completedBefore = `${nextWeekStart}T00:00:00.000Z`;

	const attemptRows = await db
		.select({
			attemptId: attempts.id,
			sessionId: attempts.sessionId,
			problemId: problems.id,
			title: problems.title,
			slug: problems.slug,
			url: problems.url,
			difficulty: problems.difficulty,
			outcome: attempts.outcome,
			confidence: attempts.confidence,
			redoDate: attempts.redoDate,
			completedAt: attempts.completedAt,
			notes: attempts.notes,
			elapsedMs: sql<number>`coalesce(sum((julianday(${timerSegments.endedAt}) - julianday(${timerSegments.startedAt})) * 86400000), 0)`
		})
		.from(attempts)
		.innerJoin(problems, eq(problems.id, attempts.problemId))
		.leftJoin(timerSegments, eq(timerSegments.attemptId, attempts.id))
		.where(
			and(
				eq(attempts.userId, userId),
				sql`${attempts.completedAt} >= ${completedFrom}`,
				sql`${attempts.completedAt} < ${completedBefore}`
			)
		)
		.groupBy(attempts.id)
		.orderBy(asc(attempts.completedAt));

	const attemptIds = attemptRows.map((attempt) => attempt.attemptId);
	const [mistakeRows, patternRows] =
		attemptIds.length === 0
			? [[], []]
			: await Promise.all([
					db
						.select({
							attemptId: attemptMistakes.attemptId,
							id: mistakes.id,
							name: mistakes.name,
							guardrail: mistakes.guardrail,
							note: attemptMistakes.note
						})
						.from(attemptMistakes)
						.innerJoin(mistakes, eq(mistakes.id, attemptMistakes.mistakeId))
						.where(inArray(attemptMistakes.attemptId, attemptIds)),
					db
						.select({
							attemptId: attemptPatterns.attemptId,
							id: patterns.id,
							name: patterns.name,
							recognitionTrigger: patterns.recognitionTrigger,
							note: attemptPatterns.note
						})
						.from(attemptPatterns)
						.innerJoin(patterns, eq(patterns.id, attemptPatterns.patternId))
						.where(inArray(attemptPatterns.attemptId, attemptIds))
				]);

	const mistakesByAttempt = groupByAttempt(mistakeRows);
	const patternsByAttempt = groupByAttempt(patternRows);
	const attemptsExport = attemptRows.map((attempt) => ({
		id: attempt.attemptId,
		sessionId: attempt.sessionId,
		completedAt: attempt.completedAt!,
		outcome: attempt.outcome,
		confidence: attempt.confidence,
		redoDate: attempt.redoDate,
		elapsedMs: Math.round(Number(attempt.elapsedMs ?? 0)),
		notes: attempt.notes,
		problem: {
			id: attempt.problemId,
			title: attempt.title,
			slug: attempt.slug,
			url: attempt.url,
			difficulty: attempt.difficulty
		},
		mistakes: mistakesByAttempt.get(attempt.attemptId) ?? [],
		patterns: patternsByAttempt.get(attempt.attemptId) ?? []
	}));

	const redoRows = await db
		.select({
			attemptId: attempts.id,
			problemId: problems.id,
			title: problems.title,
			slug: problems.slug,
			url: problems.url,
			difficulty: problems.difficulty,
			redoDate: attempts.redoDate,
			completedAt: attempts.completedAt,
			outcome: attempts.outcome,
			confidence: attempts.confidence
		})
		.from(attempts)
		.innerJoin(problems, eq(problems.id, attempts.problemId))
		.where(and(eq(attempts.userId, userId), isNotNull(attempts.redoDate)))
		.orderBy(desc(attempts.completedAt));

	const latestByProblem = new Map<string, (typeof redoRows)[number]>();
	for (const row of redoRows) {
		if (
			!row.completedAt ||
			!row.redoDate ||
			latestByProblem.has(row.problemId)
		) {
			continue;
		}
		latestByProblem.set(row.problemId, row);
	}

	const redoQueue = [...latestByProblem.values()]
		.filter((row) => row.redoDate !== null && row.redoDate <= weekEnd)
		.sort(
			(a, b) =>
				(a.redoDate ?? '').localeCompare(b.redoDate ?? '') ||
				(b.completedAt ?? '').localeCompare(a.completedAt ?? '')
		)
		.map((row) => ({
			attemptId: row.attemptId,
			dueDate: row.redoDate!,
			lastCompletedAt: row.completedAt!,
			outcome: row.outcome,
			confidence: row.confidence,
			problem: {
				id: row.problemId,
				title: row.title,
				slug: row.slug,
				url: row.url,
				difficulty: row.difficulty
			}
		}));

	const briefingPreview = await getBriefingPreview(db, userId, now);

	return {
		version: 1,
		generatedAt: isoNow(now),
		week: {
			start: weekStart,
			end: weekEnd
		},
		summary: {
			completedAttempts: attemptsExport.length,
			solvedIndependently: attemptsExport.filter(
				(attempt) => attempt.outcome === 'solved_independently'
			).length,
			needsRedo: redoQueue.length,
			averageConfidence: average(
				attemptsExport
					.map((attempt) => attempt.confidence)
					.filter((confidence) => confidence !== null)
			)
		},
		attempts: attemptsExport,
		redoQueue,
		focus: {
			mistakes: briefingPreview.mistakes,
			redosDueToday: briefingPreview.redos
		}
	};
}

function groupByAttempt<T extends { attemptId: string }>(rows: T[]) {
	const grouped = new Map<string, Omit<T, 'attemptId'>[]>();
	for (const row of rows) {
		const { attemptId, ...item } = row;
		grouped.set(attemptId, [...(grouped.get(attemptId) ?? []), item]);
	}
	return grouped;
}

function average(values: number[]) {
	if (values.length === 0) return null;
	return (
		Math.round(
			(values.reduce((total, value) => total + value, 0) / values.length) * 100
		) / 100
	);
}
