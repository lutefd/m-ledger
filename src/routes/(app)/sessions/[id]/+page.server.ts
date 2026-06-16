import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import {
	acknowledgeBriefing,
	activateProblem,
	getSessionDetail,
	pauseSession
} from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals, params }) => {
	const detail = await getSessionDetail(db, requireUser(locals).id, params.id);
	if (!detail) throw redirect(303, '/history');
	return detail;
};

export const actions: Actions = {
	acknowledge: async ({ locals, params }) => {
		await acknowledgeBriefing(db, requireUser(locals).id, params.id!);
		return { ok: true };
	},
	activate: async ({ request, locals, params }) => {
		const user = requireUser(locals);
		const problemId = String((await request.formData()).get('problemId') ?? '');
		try {
			await activateProblem(db, user.id, params.id!, problemId);
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not activate problem.'
			});
		}
		return { ok: true };
	},
	pause: async ({ locals, params }) => {
		await pauseSession(db, requireUser(locals).id, params.id!);
		return { ok: true };
	},
	complete: async ({ locals, params }) => {
		await pauseSession(db, requireUser(locals).id, params.id!);
		throw redirect(303, `/sessions/${params.id}/recap`);
	}
};
