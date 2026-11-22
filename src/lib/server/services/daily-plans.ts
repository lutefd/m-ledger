import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import {
	dailyPlanItems,
	dailyPlans,
	problems,
	studySessions
} from '$lib/server/db/schema';
import { isoNow, isValidDateOnly, localDateOnly } from '$lib/utils/dates';
import {
	upsertDailyPlanSchema,
	type DailyPlanItemInput,
	type UpsertDailyPlanInput
} from '$lib/server/validation/daily-plans';
import { createProblem, parseLeetCodeProblemUrl } from './problems';
import {
	createStudySession,
	deleteStudySession,
	getUnfinishedSession
} from './sessions';

export class DailyPlanError extends Error {
	constructor(
		message: string,
		readonly status: number = 400
	) {
		super(message);
		this.name = 'DailyPlanError';
	}
}

export type DailyPlanView = {
	id: string;
	date: string;
	name: string | null;
	startedSessionId: string | null;
	started: boolean;
	createdAt: string;
	updatedAt: string;
	items: {
		id: string;
		position: number;
		dueReason: string;
		source: string;
		problemId: string;
		title: string;
		slug: string;
		url: string;
	}[];
};

function resolveItemUrl(item: DailyPlanItemInput) {
	if (item.url) return parseLeetCodeProblemUrl(item.url).url;
	return `https://leetcode.com/problems/${item.slug}/`;
}

export async function getDailyPlan(
	db: Db,
	userId: string,
	planDate: string
): Promise<DailyPlanView | null> {
	if (!isValidDateOnly(planDate)) {
		throw new DailyPlanError('date must be a valid YYYY-MM-DD.');
	}

	const plan = await db.query.dailyPlans.findFirst({
		where: and(eq(dailyPlans.userId, userId), eq(dailyPlans.planDate, planDate))
	});
	if (!plan) return null;

	const items = await db
		.select({
			id: dailyPlanItems.id,
			position: dailyPlanItems.position,
			dueReason: dailyPlanItems.dueReason,
			source: dailyPlanItems.source,
			problemId: problems.id,
			title: problems.title,
			slug: problems.slug,
			url: problems.url
		})
		.from(dailyPlanItems)
		.innerJoin(problems, eq(problems.id, dailyPlanItems.problemId))
		.where(eq(dailyPlanItems.planId, plan.id))
		.orderBy(asc(dailyPlanItems.position));

	return {
		id: plan.id,
		date: plan.planDate,
		name: plan.name,
		startedSessionId: plan.startedSessionId,
		started: Boolean(plan.startedSessionId),
		createdAt: plan.createdAt,
		updatedAt: plan.updatedAt,
		items
	};
}

export async function getTodayPlan(db: Db, userId: string, now = new Date()) {
	return getDailyPlan(db, userId, localDateOnly(now));
}

async function planHasStartedSession(
	db: Db,
	plan: typeof dailyPlans.$inferSelect
) {
	if (!plan.startedSessionId) return false;
	const session = await db.query.studySessions.findFirst({
		where: and(
			eq(studySessions.id, plan.startedSessionId),
			eq(studySessions.userId, plan.userId)
		)
	});
	return Boolean(session);
}

export async function upsertDailyPlan(
	db: Db,
	userId: string,
	raw: UpsertDailyPlanInput
) {
	const input = upsertDailyPlanSchema.parse(raw);
	if (!isValidDateOnly(input.date)) {
		throw new DailyPlanError('date must be a valid YYYY-MM-DD.');
	}

	const existing = await db.query.dailyPlans.findFirst({
		where: and(
			eq(dailyPlans.userId, userId),
			eq(dailyPlans.planDate, input.date)
		)
	});

	if (existing && (await planHasStartedSession(db, existing))) {
		throw new DailyPlanError(
			'This plan was already started and cannot be replaced.',
			409
		);
	}

	const problemRows: {
		problemId: string;
		position: number;
		dueReason: string;
		source: string;
	}[] = [];
	const seenUrls = new Set<string>();

	for (const [index, item] of input.items.entries()) {
		let url: string;
		try {
			url = resolveItemUrl(item);
		} catch (error) {
			throw new DailyPlanError(
				error instanceof Error ? error.message : 'Invalid LeetCode URL.'
			);
		}
		if (seenUrls.has(url)) {
			throw new DailyPlanError('A plan cannot list the same problem twice.');
		}
		seenUrls.add(url);
		const problem = await createProblem(db, {
			userId,
			url,
			title: item.title
		});
		problemRows.push({
			problemId: problem.id,
			position: index + 1,
			dueReason: item.dueReason,
			source: item.source
		});
	}

	const now = isoNow();

	db.transaction((tx) => {
		const current = tx.query.dailyPlans
			.findFirst({
				where: and(
					eq(dailyPlans.userId, userId),
					eq(dailyPlans.planDate, input.date)
				)
			})
			.sync();
		if (
			current?.startedSessionId &&
			tx.query.studySessions
				.findFirst({
					where: and(
						eq(studySessions.id, current.startedSessionId),
						eq(studySessions.userId, userId)
					)
				})
				.sync()
		) {
			throw new DailyPlanError(
				'This plan was already started and cannot be replaced.',
				409
			);
		}

		const planId = current?.id ?? crypto.randomUUID();
		if (current) {
			tx.delete(dailyPlanItems).where(eq(dailyPlanItems.planId, planId)).run();
			tx.update(dailyPlans)
				.set({
					name: input.name,
					updatedAt: now,
					startedSessionId: null
				})
				.where(eq(dailyPlans.id, planId))
				.run();
		} else {
			tx.insert(dailyPlans)
				.values({
					id: planId,
					userId,
					planDate: input.date,
					name: input.name,
					createdAt: now,
					updatedAt: now
				})
				.run();
		}

		tx.insert(dailyPlanItems)
			.values(
				problemRows.map((row) => ({
					id: crypto.randomUUID(),
					planId,
					problemId: row.problemId,
					position: row.position,
					dueReason: row.dueReason,
					source: row.source
				}))
			)
			.run();
	});

	return getDailyPlan(db, userId, input.date);
}

export async function startSessionFromDailyPlan(
	db: Db,
	userId: string,
	planDate: string
) {
	const plan = await getDailyPlan(db, userId, planDate);
	if (!plan) throw new DailyPlanError('No plan found for that date.', 404);
	if (plan.items.length === 0) {
		throw new DailyPlanError('Plan has no problems.');
	}

	const openSession = await getUnfinishedSession(db, userId);
	if (openSession) {
		if (plan.startedSessionId === openSession.id) {
			return openSession.id;
		}
		throw new DailyPlanError(
			'Finish or abandon the open session before starting this plan.',
			409
		);
	}

	if (plan.startedSessionId) {
		const prior = await db.query.studySessions.findFirst({
			where: and(
				eq(studySessions.id, plan.startedSessionId),
				eq(studySessions.userId, userId)
			)
		});
		if (prior) {
			throw new DailyPlanError(
				'This plan was already started. Open it from History or Today.',
				409
			);
		}
	}

	const problemIds = plan.items.map((item) => item.problemId);
	const sessionId = await createStudySession(db, userId, problemIds, {
		reuseOpen: false,
		name: plan.name
	});

	try {
		db.transaction((tx) => {
			const current = tx.query.dailyPlans
				.findFirst({
					where: and(eq(dailyPlans.id, plan.id), eq(dailyPlans.userId, userId))
				})
				.sync();
			if (!current) {
				throw new DailyPlanError('No plan found for that date.', 404);
			}
			if (
				current.startedSessionId &&
				tx.query.studySessions
					.findFirst({
						where: and(
							eq(studySessions.id, current.startedSessionId),
							eq(studySessions.userId, userId)
						)
					})
					.sync()
			) {
				throw new DailyPlanError(
					'This plan was already started. Open it from History or Today.',
					409
				);
			}

			const currentIds = tx
				.select({ problemId: dailyPlanItems.problemId })
				.from(dailyPlanItems)
				.where(eq(dailyPlanItems.planId, plan.id))
				.orderBy(asc(dailyPlanItems.position))
				.all()
				.map((item) => item.problemId);
			if (
				currentIds.length !== problemIds.length ||
				currentIds.some((id, index) => id !== problemIds[index])
			) {
				throw new DailyPlanError(
					'This plan changed. Refresh Today and start again.',
					409
				);
			}

			tx.update(dailyPlans)
				.set({
					startedSessionId: sessionId,
					updatedAt: isoNow()
				})
				.where(and(eq(dailyPlans.id, plan.id), eq(dailyPlans.userId, userId)))
				.run();
		});
	} catch (error) {
		await deleteStudySession(db, userId, sessionId);
		throw error;
	}

	return sessionId;
}
