import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { getTodaySnapshot } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) =>
	getTodaySnapshot(db, requireUser(locals).id);
