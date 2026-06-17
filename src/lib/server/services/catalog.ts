import { and, asc, desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { mistakes, patterns, problems } from '$lib/server/db/schema';
import { normalizeName } from './normalize';

export async function listProblems(db: Db, userId: string) {
	return db.query.problems.findMany({
		where: eq(problems.userId, userId),
		orderBy: [desc(problems.createdAt)]
	});
}

export async function listMistakes(db: Db, userId: string) {
	return db.query.mistakes.findMany({
		where: eq(mistakes.userId, userId),
		orderBy: [asc(mistakes.archived), asc(mistakes.name)]
	});
}

export async function createMistake(
	db: Db,
	input: {
		userId: string;
		name: string;
		description?: string;
		guardrail?: string;
	}
) {
	const normalizedName = normalizeName(input.name);
	if (!normalizedName) throw new Error('Name is required.');
	await db
		.insert(mistakes)
		.values({
			id: crypto.randomUUID(),
			userId: input.userId,
			name: input.name.trim(),
			normalizedName,
			description: input.description?.trim() || null,
			guardrail: input.guardrail?.trim() || null
		})
		.onConflictDoNothing();

	return db.query.mistakes.findFirst({
		where: and(
			eq(mistakes.userId, input.userId),
			eq(mistakes.normalizedName, normalizedName)
		)
	});
}

export async function listPatterns(db: Db, userId: string) {
	return db.query.patterns.findMany({
		where: eq(patterns.userId, userId),
		orderBy: [asc(patterns.archived), asc(patterns.name)]
	});
}

export async function createPattern(
	db: Db,
	input: { userId: string; name: string; recognitionTrigger?: string }
) {
	const normalizedName = normalizeName(input.name);
	if (!normalizedName) throw new Error('Name is required.');
	await db
		.insert(patterns)
		.values({
			id: crypto.randomUUID(),
			userId: input.userId,
			name: input.name.trim(),
			normalizedName,
			recognitionTrigger: input.recognitionTrigger?.trim() || null
		})
		.onConflictDoNothing();

	return db.query.patterns.findFirst({
		where: and(
			eq(patterns.userId, input.userId),
			eq(patterns.normalizedName, normalizedName)
		)
	});
}
