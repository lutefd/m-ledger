import { fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { createMistake, listMistakes } from '$lib/server/services/catalog';
import { mistakeInputSchema } from '$lib/server/validation/catalog';

export const load: PageServerLoad = async ({ locals }) => ({
	mistakes: await listMistakes(db, requireUser(locals).id)
});

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = requireUser(locals);
		const parsed = mistakeInputSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success)
			return fail(400, { message: 'Check the mistake form.' });
		await createMistake(db, { userId: user.id, ...parsed.data });
		return { message: 'Mistake saved.' };
	}
};
