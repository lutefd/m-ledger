import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import {
	createMistake,
	createPattern,
	listMistakes,
	listPatterns
} from '$lib/server/services/catalog';
import { getSessionDetail, saveRecap } from '$lib/server/services/sessions';
import { suggestRedoDate } from '$lib/server/services/scheduling';
import {
	mistakeInputSchema,
	patternInputSchema
} from '$lib/server/validation/catalog';
import { recapSchema } from '$lib/server/validation/sessions';
import { localDateOnly } from '$lib/utils/dates';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals);
	const detail = await getSessionDetail(db, user.id, params.id);
	if (!detail) throw redirect(303, '/history');
	if (detail.session.status !== 'paused') {
		throw redirect(303, `/sessions/${params.id}`);
	}
	return {
		...detail,
		mistakes: await listMistakes(db, user.id),
		patterns: await listPatterns(db, user.id),
		redoSuggestions: Object.fromEntries(
			[1, 2, 3, 4, 5].map((confidence) => [
				confidence,
				suggestRedoDate(confidence, localDateOnly())
			])
		)
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const attemptIds = form.getAll('attemptId').map(String);
		const parsed = recapSchema.safeParse(
			attemptIds.map((attemptId) => ({
				attemptId,
				outcome: String(form.get(`outcome:${attemptId}`)),
				confidence: Number(form.get(`confidence:${attemptId}`)),
				notesDocument: String(form.get(`notesDocument:${attemptId}`) ?? ''),
				redoDate: String(form.get(`redoDate:${attemptId}`) ?? ''),
				mistakeIds: form.getAll(`mistakes:${attemptId}`).map(String),
				patternIds: form.getAll(`patterns:${attemptId}`).map(String)
			}))
		);

		if (!parsed.success) {
			return fail(400, {
				message:
					parsed.error.issues[0]?.message ??
					'Every attempted problem needs an outcome and confidence.'
			});
		}

		try {
			await saveRecap(db, user.id, params.id!, parsed.data);
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not save recap.'
			});
		}
		throw redirect(303, `/sessions/${params.id}`);
	},
	createMistake: async ({ request, locals }) => {
		const user = requireUser(locals);
		const parsed = mistakeInputSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success)
			return fail(400, { message: 'Check the mistake form.' });
		const mistake = await createMistake(db, {
			userId: user.id,
			...parsed.data
		});
		return { ok: true, createdMistakeId: mistake?.id };
	},
	createPattern: async ({ request, locals }) => {
		const user = requireUser(locals);
		const parsed = patternInputSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success)
			return fail(400, { message: 'Check the pattern form.' });
		const pattern = await createPattern(db, {
			userId: user.id,
			...parsed.data
		});
		return { ok: true, createdPatternId: pattern?.id };
	}
};
