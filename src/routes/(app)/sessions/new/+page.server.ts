import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { listProblems } from '$lib/server/services/catalog';
import {
	createStudySession,
	getUnfinishedSession
} from '$lib/server/services/sessions';
import { sessionNameSchema } from '$lib/server/validation/sessions';

export const load: PageServerLoad = async ({ locals, url }) => ({
	problems: await listProblems(db, requireUser(locals).id),
	message: url.searchParams.get('message')
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const openSession = await getUnfinishedSession(db, user.id);
		if (openSession) {
			throw redirect(
				303,
				`/sessions/${openSession.id}?message=${encodeURIComponent('You already have an unfinished session.')}`
			);
		}
		const formData = await request.formData();
		const problemIds = formData.getAll('problemIds').map(String);
		const name = sessionNameSchema.safeParse(formData.get('name'));
		if (!name.success)
			return fail(400, { message: name.error.issues[0]?.message });
		let sessionId: string;
		try {
			sessionId = await createStudySession(db, user.id, problemIds, {
				name: name.data
			});
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not create session.'
			});
		}
		throw redirect(303, `/sessions/${sessionId}`);
	}
};
