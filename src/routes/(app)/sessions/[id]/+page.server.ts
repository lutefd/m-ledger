import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import {
	createMistake,
	createPattern,
	listProblems
} from '$lib/server/services/catalog';
import {
	mistakeInputSchema,
	patternInputSchema
} from '$lib/server/validation/catalog';
import {
	acknowledgeBriefing,
	addProblemToSession,
	activateProblem,
	createProblemAndAddToSession,
	deleteStudySession,
	enterSessionRecap,
	getSessionDetail,
	pauseSession,
	updateSessionNotes
} from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const user = requireUser(locals);
	const detail = await getSessionDetail(db, user.id, params.id);
	if (!detail) throw redirect(303, '/history');
	return {
		...detail,
		problems: await listProblems(db, user.id),
		message: url.searchParams.get('message')
	};
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
		try {
			await pauseSession(db, requireUser(locals).id, params.id!);
		} catch (error) {
			return fail(400, {
				message: error instanceof Error ? error.message : 'Could not pause.'
			});
		}
		return { ok: true };
	},
	notebook: async ({ request, locals, params }) => {
		const document = String((await request.formData()).get('document') ?? '');
		try {
			await updateSessionNotes(
				db,
				requireUser(locals).id,
				params.id!,
				document
			);
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not save notebook.'
			});
		}
		return { ok: true, message: 'Notebook saved.' };
	},
	addProblem: async ({ request, locals, params }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const problemId = String(form.get('problemId') ?? '');
		const url = String(form.get('url') ?? '');
		try {
			const item = problemId
				? await addProblemToSession(db, user.id, params.id!, problemId)
				: await createProblemAndAddToSession(db, user.id, params.id!, url);
			return { ok: true, focusProblemId: item.problemId };
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not add problem.'
			});
		}
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
	},
	delete: async ({ locals, params }) => {
		await deleteStudySession(db, requireUser(locals).id, params.id!);
		throw redirect(303, '/history');
	},
	complete: async ({ locals, params }) => {
		try {
			await enterSessionRecap(db, requireUser(locals).id, params.id!);
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not enter recap.'
			});
		}
		throw redirect(303, `/sessions/${params.id}/recap`);
	}
};
