import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { listHistory } from '$lib/server/services/history';
import {
	deleteStudySession,
	listRecentSessions
} from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	const [sessions, history] = await Promise.all([
		listRecentSessions(db, user.id, 50),
		listHistory(db, user.id, 100)
	]);
	return { sessions, history };
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const sessionId = String((await request.formData()).get('sessionId') ?? '');
		if (!sessionId)
			return fail(400, { message: 'Choose a session to delete.' });
		await deleteStudySession(db, requireUser(locals).id, sessionId);
		return { ok: true };
	}
};
