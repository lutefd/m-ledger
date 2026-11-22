import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyGitHubWebhookSignature } from '../../src/lib/server/security';

describe('GitHub webhook signatures', () => {
	it('accepts the exact HMAC signature and rejects altered requests', () => {
		const body = JSON.stringify({ hello: 'github' });
		const secret = 'test-webhook-secret';
		const signature = `sha256=${createHmac('sha256', secret)
			.update(body)
			.digest('hex')}`;

		expect(verifyGitHubWebhookSignature(body, signature, secret)).toBe(true);
		expect(verifyGitHubWebhookSignature(`${body} `, signature, secret)).toBe(
			false
		);
		expect(verifyGitHubWebhookSignature(body, null, secret)).toBe(false);
	});
});
