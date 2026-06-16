import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { listRecentSessions } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) => ({
	sessions: await listRecentSessions(db, locals.user!.id, 50)
});
