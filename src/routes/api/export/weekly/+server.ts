import { error, json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { resolveExportUserId } from '$lib/server/services/export-auth';
import { getWeeklyExport } from '$lib/server/services/weekly-export';

export const GET: RequestHandler = async ({ locals, request, url }) => {
	const userId = await resolveExportUserId(
		db,
		locals,
		request.headers.get('authorization')
	);

	try {
		const payload = await getWeeklyExport(db, userId, {
			weekStart: url.searchParams.get('weekStart')
		});
		return json(payload);
	} catch (err) {
		if (err instanceof Error && err.message.startsWith('weekStart')) {
			throw error(400, err.message);
		}
		throw err;
	}
};
