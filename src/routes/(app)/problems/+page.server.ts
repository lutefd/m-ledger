import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { listProblems } from '$lib/server/services/catalog';
import { createProblem } from '$lib/server/services/problems';
import {
	getNeetCodeConfig,
	requireConfiguredImportUser,
	syncNeetCodeHistory
} from '$lib/server/services/neetcode';
import { problemInputSchema } from '$lib/server/validation/catalog';

export const load: PageServerLoad = async ({ locals }) => ({
	problems: await listProblems(db, requireUser(locals).id)
});

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const user = requireUser(locals);
		const parsed = problemInputSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success)
			return fail(400, { message: 'Check the problem form.' });

		try {
			await createProblem(db, {
				userId: user.id,
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
	},
	sync: async ({ locals }) => {
		const user = requireUser(locals);
		try {
			const config = getNeetCodeConfig();
			requireConfiguredImportUser(user.email, config);
			const result = await syncNeetCodeHistory(db, user.id, { config });
			return {
				message: `NeetCode history synced: ${result.imported} new solve${result.imported === 1 ? '' : 's'}, ${result.problemsCreated} new problem${result.problemsCreated === 1 ? '' : 's'}.`
			};
		} catch (error) {
			return fail(400, {
				message:
					error instanceof Error
						? error.message
						: 'Could not sync NeetCode history.'
			});
		}
	}
};
