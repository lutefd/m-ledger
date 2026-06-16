import { redirect } from '@sveltejs/kit';

export function requireUser(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/login');
	return locals.user;
}
