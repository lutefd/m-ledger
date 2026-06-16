import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { listProblems } from '$lib/server/services/catalog';
import { createStudySession } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals }) => ({
	problems: await listProblems(db, locals.user!.id)
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const problemIds = (await request.formData())
			.getAll('problemIds')
			.map(String);
		try {
			const sessionId = await createStudySession(
				db,
				locals.user!.id,
				problemIds
			);
			throw redirect(303, `/sessions/${sessionId}`);
		} catch (error) {
			if (error instanceof Response) throw error;
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not create session.'
			});
		}
	}
};
