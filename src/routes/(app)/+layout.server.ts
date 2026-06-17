import type { LayoutServerLoad } from './$types';
import { requireUser } from '$lib/server/guards';
import { db } from '$lib/server/db/client';
import { getOpenSessionSummary } from '$lib/server/services/sessions';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	return {
		user,
		openSession: await getOpenSessionSummary(db, user.id)
	};
};
