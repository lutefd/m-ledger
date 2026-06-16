import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { getTodaySnapshot } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) =>
	getTodaySnapshot(db, locals.user!.id);
