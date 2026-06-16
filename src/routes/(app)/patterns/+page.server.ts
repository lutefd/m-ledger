import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { createPattern, listPatterns } from '$lib/server/services/catalog';
import { patternInputSchema } from '$lib/server/validation/catalog';

export const load: PageServerLoad = async ({ locals }) => ({
	patterns: await listPatterns(db, locals.user!.id)
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const parsed = patternInputSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success)
			return fail(400, { message: 'Check the pattern form.' });
		await createPattern(db, { userId: locals.user!.id, ...parsed.data });
		return { message: 'Pattern saved.' };
	}
};
