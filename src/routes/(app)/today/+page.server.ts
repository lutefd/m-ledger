import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import {
	DailyPlanError,
	getTodayPlan,
	startSessionFromDailyPlan
} from '$lib/server/services/daily-plans';
import { getTodaySnapshot } from '$lib/server/services/sessions';
import { localDateOnly } from '$lib/utils/dates';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = requireUser(locals).id;
	const snapshot = await getTodaySnapshot(db, userId);
	const plan = await getTodayPlan(db, userId);
	return {
		...snapshot,
		plan,
		planDate: localDateOnly()
	};
};

export const actions: Actions = {
	startPlan: async ({ locals }) => {
		const user = requireUser(locals);
		try {
			const sessionId = await startSessionFromDailyPlan(
				db,
				user.id,
				localDateOnly()
			);
			throw redirect(303, `/sessions/${sessionId}`);
		} catch (error) {
			if (error && typeof error === 'object' && 'status' in error) throw error;
			if (error instanceof DailyPlanError) {
				return fail(error.status, { message: error.message });
			}
			return fail(400, {
				message:
					error instanceof Error
						? error.message
						: 'Could not start session from plan.'
			});
		}
	}
};
