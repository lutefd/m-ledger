import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { listProblems } from '$lib/server/services/catalog';
import { createStudySession } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) => ({
	problems: await listProblems(db, requireUser(locals).id)
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const problemIds = (await request.formData())
			.getAll('problemIds')
			.map(String);
		let sessionId: string;
		try {
			sessionId = await createStudySession(db, user.id, problemIds);
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not create session.'
			});
		}
		throw redirect(303, `/sessions/${sessionId}`);
	}
};
