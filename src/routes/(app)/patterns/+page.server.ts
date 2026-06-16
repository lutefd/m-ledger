import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { createPattern, listPatterns } from '$lib/server/services/catalog';
import { patternInputSchema } from '$lib/server/validation/catalog';

export const load: PageServerLoad = async ({ locals }) => ({
	patterns: await listPatterns(db, requireUser(locals).id)
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const parsed = patternInputSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success)
			return fail(400, { message: 'Check the pattern form.' });
		await createPattern(db, { userId: user.id, ...parsed.data });
		return { message: 'Pattern saved.' };
	}
};
