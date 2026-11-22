import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db/client';
import { resolveApiUserId } from '$lib/server/services/api-auth';
import { renameStudySession } from '$lib/server/services/sessions';
import { sessionNameSchema } from '$lib/server/validation/sessions';

const renameSchema = z.object({ name: sessionNameSchema });

/** Rename a study session. `{ "name": null }` or `""` clears the name. */
export const PATCH: RequestHandler = async ({ locals, request, params }) => {
	const userId = await resolveApiUserId(
		db,
		locals,
		request.headers.get('authorization')
	);

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Expected a JSON body.');
	}

	const parsed = renameSchema.safeParse(body);
	if (!parsed.success) {
		throw error(
			400,
			parsed.error.issues[0]?.message ?? 'Invalid session payload.'
		);
	}

	const renamed = await renameStudySession(
		db,
		userId,
		params.id!,
		parsed.data.name
	);
	if (!renamed) throw error(404, 'Session not found.');
	return json({ session: { id: params.id, name: parsed.data.name } });
};
