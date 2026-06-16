import {
	error,
	fail,
	redirect,
	type Actions,
	type ServerLoad
} from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { env } from '$lib/server/env';
import { timingSafeTokenEqual } from '$lib/server/security';
import { countUsers } from '$lib/server/services/users';
import { setupSchema } from '$lib/server/validation/auth';

export const load: ServerLoad = async () => {
	if ((await countUsers(db)) > 0) {
		error(404, 'Not found');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		if ((await countUsers(db)) > 0) {
			return fail(404, { message: 'Setup is no longer available.' });
		}

		const parsed = setupSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors });
		}

		if (!timingSafeTokenEqual(parsed.data.token, env.SETUP_TOKEN)) {
			return fail(403, { message: 'Invalid setup token.' });
		}

		try {
			await auth.api.signUpEmail({
				body: {
					name: parsed.data.name,
					email: parsed.data.email,
					password: parsed.data.password
				},
				headers: request.headers
			});
		} catch (error) {
			const message =
				error instanceof APIError
					? error.message
					: 'Could not create the owner account.';
			return fail(400, { message });
		}

		throw redirect(303, '/login');
	}
};
