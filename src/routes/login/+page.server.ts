import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db/client';
import { countUsers } from '$lib/server/services/users';
import { loginSchema } from '$lib/server/validation/auth';

export const load: ServerLoad = async () => {
	if ((await countUsers(db)) === 0) throw redirect(303, '/setup');
	return {};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = loginSchema.safeParse(
			Object.fromEntries(await request.formData())
		);
		if (!parsed.success) {
			return fail(400, { errors: parsed.error.flatten().fieldErrors });
		}

		try {
			await auth.api.signInEmail({
				body: {
					email: parsed.data.email,
					password: parsed.data.password
				},
				headers: request.headers
			});
		} catch (error) {
			const message =
				error instanceof APIError ? error.message : 'Could not sign in.';
			return fail(400, { message });
		}

		throw redirect(303, '/today');
	}
};
