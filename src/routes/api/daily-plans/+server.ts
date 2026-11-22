import { error, json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { resolveApiUserId } from '$lib/server/services/api-auth';
import {
	DailyPlanError,
	getDailyPlan,
	upsertDailyPlan
} from '$lib/server/services/daily-plans';
import { upsertDailyPlanSchema } from '$lib/server/validation/daily-plans';
import { localDateOnly } from '$lib/utils/dates';

export const GET: RequestHandler = async ({ locals, request, url }) => {
	const userId = await resolveApiUserId(
		db,
		locals,
		request.headers.get('authorization')
	);
	const date = url.searchParams.get('date') ?? localDateOnly();

	try {
		const plan = await getDailyPlan(db, userId, date);
		if (!plan) return json({ plan: null }, { status: 200 });
		return json({ plan });
	} catch (err) {
		if (err instanceof DailyPlanError) throw error(err.status, err.message);
		throw err;
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const userId = await resolveApiUserId(
		db,
		locals,
		request.headers.get('authorization')
	);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Expected a JSON body.');
	}

	const parsed = upsertDailyPlanSchema.safeParse(body);
	if (!parsed.success) {
		throw error(
			400,
			parsed.error.issues[0]?.message ?? 'Invalid daily plan payload.'
		);
	}

	try {
		const plan = await upsertDailyPlan(db, userId, parsed.data);
		return json({ plan }, { status: 200 });
	} catch (err) {
		if (err instanceof DailyPlanError) throw error(err.status, err.message);
		if (err instanceof Error && err.name === 'ZodError') {
			throw error(400, err.message);
		}
		throw err;
	}
};
