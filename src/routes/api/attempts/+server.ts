import { error, json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { resolveApiUserId } from '$lib/server/services/api-auth';
import {
	AttemptsFeedError,
	listCompletedAttemptsSince,
	parseAttemptsSince
} from '$lib/server/services/attempts-feed';

export const GET: RequestHandler = async ({ locals, request, url }) => {
	const userId = await resolveApiUserId(
		db,
		locals,
		request.headers.get('authorization')
	);

	try {
		const since = parseAttemptsSince(url.searchParams.get('since'));
		const payload = await listCompletedAttemptsSince(db, userId, since);
		return json(payload);
	} catch (err) {
		if (err instanceof AttemptsFeedError) throw error(err.status, err.message);
		throw err;
	}
};
