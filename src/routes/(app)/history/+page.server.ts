import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { listRecentSessions } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) => ({
	sessions: await listRecentSessions(db, requireUser(locals).id, 50)
});
