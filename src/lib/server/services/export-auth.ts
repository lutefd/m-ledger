import { asc, eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { Db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';
import { env } from '$lib/server/env';
import { timingSafeTokenEqual } from '$lib/server/security';

export async function resolveExportUserId(
	db: Db,
	locals: App.Locals,
	authorization: string | null
) {
	if (locals.user) return locals.user.id;

	const token = bearerToken(authorization);
	if (!token || !env.EXPORT_API_TOKEN) {
		throw error(401, 'Authentication required.');
	}
	if (!timingSafeTokenEqual(token, env.EXPORT_API_TOKEN)) {
		throw error(401, 'Authentication required.');
	}

	const user = env.EXPORT_API_USER_EMAIL
		? await db.query.users.findFirst({
				where: eq(users.email, env.EXPORT_API_USER_EMAIL)
			})
		: await db.query.users.findFirst({
				orderBy: [asc(users.createdAt)]
			});
	if (!user) throw error(500, 'Export API user was not found.');
	return user.id;
}

function bearerToken(value: string | null) {
	const match = value?.match(/^Bearer\s+(.+)$/i);
	return match?.[1] ?? null;
}
