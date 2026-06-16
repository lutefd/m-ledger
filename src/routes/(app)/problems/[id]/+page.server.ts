import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { requireUser } from '$lib/server/guards';
import { getProblemHistory } from '$lib/server/services/sessions';

export const load: PageServerLoad = async ({ locals, params }) => {
	const detail = await getProblemHistory(db, requireUser(locals).id, params.id);
	if (!detail) throw redirect(303, '/problems');
	return detail;
};
