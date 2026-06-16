import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import {
	deleteStudySession,
	listRecentSessions
} from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) => ({
	sessions: await listRecentSessions(db, requireUser(locals).id, 50)
});

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const sessionId = String((await request.formData()).get('sessionId') ?? '');
		if (!sessionId)
			return fail(400, { message: 'Choose a session to delete.' });
		await deleteStudySession(db, requireUser(locals).id, sessionId);
		return { ok: true };
	}
};
