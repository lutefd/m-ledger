import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { listProblems } from '$lib/server/services/catalog';
import { createProblem } from '$lib/server/services/problems';
import { problemInputSchema } from '$lib/server/validation/catalog';

export const load: PageServerLoad = async ({ locals }) => ({
	problems: await listProblems(db, locals.user!.id)
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const parsed = problemInputSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success)
			return fail(400, { message: 'Check the problem form.' });

		try {
			await createProblem(db, {
				userId: locals.user!.id,
				url: parsed.data.url,
				title: parsed.data.title,
				difficulty: parsed.data.difficulty,
				topicNames: parsed.data.topics?.split(',').map((topic) => topic.trim())
			});
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error ? error.message : 'Could not add problem.'
			});
		}

		return { message: 'Problem saved.' };
	}
};
