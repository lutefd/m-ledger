import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { listMistakes, listPatterns } from '$lib/server/services/catalog';
import {
	getSessionDetail,
	saveRecap,
	type RecapAttemptInput
} from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals, params }) => {
	const detail = await getSessionDetail(db, locals.user!.id, params.id);
	if (!detail) throw redirect(303, '/history');
	return {
		...detail,
		mistakes: await listMistakes(db, locals.user!.id),
		patterns: await listPatterns(db, locals.user!.id)
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		const form = await request.formData();
		const attemptIds = form.getAll('attemptId').map(String);
		const inputs: RecapAttemptInput[] = attemptIds.map((attemptId) => ({
			attemptId,
			outcome: String(
				form.get(`outcome:${attemptId}`)
			) as RecapAttemptInput['outcome'],
			confidence: Number(form.get(`confidence:${attemptId}`)),
			notes: String(form.get(`notes:${attemptId}`) ?? ''),
			redoDate: String(form.get(`redoDate:${attemptId}`) ?? ''),
			mistakeIds: form.getAll(`mistakes:${attemptId}`).map(String),
			patternIds: form.getAll(`patterns:${attemptId}`).map(String)
		}));

		if (inputs.length === 0)
			return fail(400, {
				message: 'Activate at least one problem before recapping.'
			});
		if (inputs.some((input) => !input.outcome || !input.confidence)) {
			return fail(400, {
				message: 'Every attempted problem needs an outcome and confidence.'
			});
		}

		try {
			await saveRecap(db, locals.user!.id, params.id!, inputs);
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not save recap.'
			});
		}
		throw redirect(303, `/sessions/${params.id}`);
	}
};
