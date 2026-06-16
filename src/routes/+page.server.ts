import { redirect, type ServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { countUsers } from '$lib/server/services/users';

export const load: ServerLoad = async ({ locals }) => {
	if (locals.user) throw redirect(303, '/today');
	if ((await countUsers(db)) === 0) throw redirect(303, '/setup');
	throw redirect(303, '/login');
};
