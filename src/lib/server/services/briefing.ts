import { desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	attemptMistakes,
	attempts,
	briefingMistakes,
	briefingRedos,
	briefings,
	mistakes,
	problems
} from '$lib/server/db/schema';
import { dateOnly, isoNow } from '$lib/utils/dates';

export type MistakeCandidate = {
	id: string;
	name: string;
	guardrail: string | null;
	occurrences: { completedAt: string; confidence: number | null }[];
};

export function rankMistakeCandidates(
	candidates: MistakeCandidate[],
	now = new Date()
) {
	const recent30Start = new Date(now);
	recent30Start.setUTCDate(recent30Start.getUTCDate() - 30);
	const previous60Start = new Date(now);
	previous60Start.setUTCDate(previous60Start.getUTCDate() - 90);

	const normalized = candidates.map((candidate) => ({
		...candidate,
		occurrences: candidate.occurrences
			.filter((occurrence) => occurrence.completedAt)
			.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
	}));

	const ranked = normalized
		.map((candidate) => {
			const occurrences = candidate.occurrences;
			const recent30 = occurrences.filter(
				(occurrence) => occurrence.completedAt >= recent30Start.toISOString()
			).length;
			const previous60 = occurrences.filter(
				(occurrence) =>
					occurrence.completedAt >= previous60Start.toISOString() &&
					occurrence.completedAt < recent30Start.toISOString()
			).length;
			const latestThree = occurrences
				.slice(0, 3)
				.filter((occurrence) => occurrence.confidence !== null);
			const averageConfidence =
				latestThree.length === 0
					? 3
					: latestThree.reduce(
							(sum, occurrence) => sum + Number(occurrence.confidence),
							0
						) / latestThree.length;
			const lastOccurrence = occurrences[0]?.completedAt;
			const qualifies =
				occurrences.length >= 2 &&
				occurrences.some(
					(occurrence) =>
						occurrence.completedAt >= previous60Start.toISOString()
				);
			return {
				...candidate,
				occurrenceCount: occurrences.length,
				lastOccurrence,
				averageConfidence,
				score: 3 * recent30 + previous60 + (6 - averageConfidence),
				qualifies
			};
		})
		.filter((candidate) => candidate.qualifies && candidate.lastOccurrence)
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.lastOccurrence.localeCompare(a.lastOccurrence) ||
				a.name.localeCompare(b.name)
		);

	const selected = ranked.slice(0, 5);
	if (selected.length >= 3) return selected;

	const selectedIds = new Set(selected.map((candidate) => candidate.id));
	const fillers = normalized
		.filter((candidate) => !selectedIds.has(candidate.id))
		.map((candidate) => ({
			...candidate,
			occurrenceCount: candidate.occurrences.length,
			lastOccurrence: candidate.occurrences[0]?.completedAt,
			averageConfidence: candidate.occurrences[0]?.confidence ?? 2,
			score: 0
		}))
		.filter((candidate) =>
			candidate.occurrences.some(
				(occurrence) =>
					(occurrence.confidence === 1 || occurrence.confidence === 2) &&
					occurrence.completedAt >= previous60Start.toISOString()
			)
		)
		.sort(
			(a, b) =>
				(b.lastOccurrence ?? '').localeCompare(a.lastOccurrence ?? '') ||
				a.name.localeCompare(b.name)
		);

	return [...selected, ...fillers].slice(0, 5);
}

export async function getBriefingPreview(
	db: Db,
	userId: string,
	now = new Date()
) {
	const rows = await db
		.select({
			mistakeId: mistakes.id,
			name: mistakes.name,
			guardrail: mistakes.guardrail,
			completedAt: attempts.completedAt,
			confidence: attempts.confidence
		})
		.from(mistakes)
		.innerJoin(attemptMistakes, eq(attemptMistakes.mistakeId, mistakes.id))
		.innerJoin(attempts, eq(attempts.id, attemptMistakes.attemptId))
		.where(eq(mistakes.userId, userId));

	const grouped = new Map<string, MistakeCandidate>();
	for (const row of rows) {
		if (!row.completedAt) continue;
		const current = grouped.get(row.mistakeId) ?? {
			id: row.mistakeId,
			name: row.name,
			guardrail: row.guardrail,
			occurrences: []
		};
		current.occurrences.push({
			completedAt: row.completedAt,
			confidence: row.confidence
		});
		grouped.set(row.mistakeId, current);
	}

	const rankedMistakes = rankMistakeCandidates([...grouped.values()], now);

	const redoRows = await db
		.select({
			attemptId: attempts.id,
			problemId: attempts.problemId,
			redoDate: attempts.redoDate,
			completedAt: attempts.completedAt,
			title: problems.title,
			url: problems.url
		})
		.from(attempts)
		.innerJoin(problems, eq(problems.id, attempts.problemId))
		.where(eq(attempts.userId, userId))
		.orderBy(desc(attempts.completedAt));

	const latestByProblem = new Map<string, (typeof redoRows)[number]>();
	for (const row of redoRows) {
		if (!row.completedAt || latestByProblem.has(row.problemId)) continue;
		latestByProblem.set(row.problemId, row);
	}

	const redos = [...latestByProblem.values()]
		.filter((redo) => redo.redoDate !== null && redo.redoDate <= dateOnly(now))
		.sort(
			(a, b) =>
				(a.redoDate ?? '').localeCompare(b.redoDate ?? '') ||
				(b.completedAt ?? '').localeCompare(a.completedAt ?? '')
		);

	return {
		mistakes: rankedMistakes.map((mistake, index) => ({
			id: mistake.id,
			rank: index + 1,
			score: Math.round(mistake.score * 100),
			occurrenceCount: mistake.occurrenceCount,
			lastOccurrence: mistake.lastOccurrence!,
			averageConfidence: Math.round(mistake.averageConfidence * 100),
			name: mistake.name,
			guardrail: mistake.guardrail
		})),
		redos: redos.map((redo, index) => ({
			rank: index + 1,
			problemId: redo.problemId,
			attemptId: redo.attemptId,
			dueDate: redo.redoDate!,
			title: redo.title,
			url: redo.url
		}))
	};
}

export async function generateBriefing(
	db: Db,
	userId: string,
	sessionId: string,
	now = new Date()
) {
	const createdAt = isoNow(now);
	const briefingId = crypto.randomUUID();
	const preview = await getBriefingPreview(db, userId, now);

	db.transaction((tx) => {
		tx.insert(briefings)
			.values({
				id: briefingId,
				userId,
				sessionId,
				createdAt
			})
			.run();

		if (preview.mistakes.length > 0) {
			tx.insert(briefingMistakes)
				.values(
					preview.mistakes.map((mistake) => ({
						briefingId,
						mistakeId: mistake.id,
						rank: mistake.rank,
						score: mistake.score,
						occurrenceCount: mistake.occurrenceCount,
						lastOccurrence: mistake.lastOccurrence,
						averageConfidence: mistake.averageConfidence
					}))
				)
				.onConflictDoNothing()
				.run();
		}

		if (preview.redos.length > 0) {
			tx.insert(briefingRedos)
				.values(
					preview.redos.map((redo) => ({
						briefingId,
						problemId: redo.problemId,
						attemptId: redo.attemptId,
						dueDate: redo.dueDate,
						rank: redo.rank
					}))
				)
				.onConflictDoNothing()
				.run();
		}
	});

	return briefingId;
}
