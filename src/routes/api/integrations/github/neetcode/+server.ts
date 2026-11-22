import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { verifyGitHubWebhookSignature } from '$lib/server/security';
import {
	configuredImportUserId,
	getWebhookConfig,
	importNeetCodeSubmissions,
	submissionsFromNeetCodePush,
	validateNeetCodePush,
	type NeetCodePushPayload
} from '$lib/server/services/neetcode';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	let config;
	try {
		config = getWebhookConfig();
	} catch (error) {
		return json(
			{
				message:
					error instanceof Error ? error.message : 'Webhook is not configured.'
			},
			{ status: 503 }
		);
	}

	if (
		!verifyGitHubWebhookSignature(
			body,
			request.headers.get('x-hub-signature-256'),
			config.webhookSecret
		)
	) {
		return json({ message: 'Invalid webhook signature.' }, { status: 401 });
	}

	const event = request.headers.get('x-github-event');
	if (event === 'ping') {
		return json({ ok: true, event: 'ping' });
	}

	if (event !== 'push') {
		return json({ ignored: true, reason: 'event' }, { status: 202 });
	}

	let payload: NeetCodePushPayload;
	try {
		payload = JSON.parse(body) as NeetCodePushPayload;
	} catch {
		return json(
			{ message: 'Webhook body must be valid JSON.' },
			{ status: 400 }
		);
	}

	const validation = validateNeetCodePush(payload, config.repository);
	if (!validation.accepted) {
		return json({ ignored: true, reason: validation.reason }, { status: 202 });
	}

	const userId = await configuredImportUserId(db, config);
	if (!userId) {
		return json(
			{ message: 'The configured NeetCode import user does not exist.' },
			{ status: 503 }
		);
	}

	try {
		const result = importNeetCodeSubmissions(
			db,
			userId,
			submissionsFromNeetCodePush(payload, config.repository)
		);
		return json({ ok: true, ...result });
	} catch (error) {
		return json(
			{
				message:
					error instanceof Error
						? error.message
						: 'Could not import submissions.'
			},
			{ status: 400 }
		);
	}
};
