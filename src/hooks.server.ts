import { redirect, type Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';

const publicPaths = ['/login', '/setup', '/api/health'];

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/api/auth/sign-up/email') {
		return new Response('Not found', { status: 404 });
	}

	if (event.url.pathname.startsWith('/api/auth/')) {
		return auth.handler(event.request);
	}

	const session = await auth.api.getSession({
		headers: event.request.headers
	});
	event.locals.user = session?.user ?? null;
	event.locals.session = session?.session ?? null;

	const isPublic = publicPaths.some(
		(path) =>
			event.url.pathname === path || event.url.pathname.startsWith(`${path}/`)
	);
	if (!event.locals.user && !isPublic) {
		throw redirect(303, '/login');
	}

	if (
		event.locals.user &&
		(event.url.pathname === '/login' || event.url.pathname === '/setup')
	) {
		throw redirect(303, '/today');
	}

	return resolve(event);
};
