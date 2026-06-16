import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { getProblemHistory } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals, params }) => {
	const detail = await getProblemHistory(db, locals.user!.id, params.id);
	if (!detail) throw redirect(303, '/problems');
	return detail;
};
