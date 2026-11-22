import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('redirects unauthenticated users to login or setup', async ({ page }) => {
	await page.goto('/today');
	await expect(page).toHaveURL(/\/(login|setup)$/);
});

test('shows provider badges, external history, source links, and empty states', async ({
	page
}) => {
	await page.goto('/setup');
	await page.getByLabel('Setup token').fill('development-setup-token');
	await page.getByLabel('Name').fill('Owner');
	await page.getByLabel('Email').fill('owner@example.com');
	await page.getByLabel('Password').fill('a-strong-e2e-password');
	await page.getByRole('button', { name: 'Create account' }).click();

	await page.waitForURL(/\/(login|today)$/);
	if (page.url().endsWith('/login')) {
		await page.getByLabel('Email').fill('owner@example.com');
		await page.getByLabel('Password').fill('a-strong-e2e-password');
		await page.getByRole('button', { name: 'Sign in' }).click();
	}
	await expect(page).toHaveURL(/\/today$/);

	await page.goto('/patterns');
	await page.getByPlaceholder('Sliding window').fill('Sliding window');
	await page
		.getByPlaceholder('When should this pattern come to mind?')
		.fill('Look for a moving range.');
	await page.getByRole('button', { name: 'Add pattern' }).click();
	await expect(
		page.locator('[data-sonner-toast]').filter({ hasText: 'Pattern saved.' })
	).toBeVisible();

	await page.goto('/history');
	await expect(page.getByText('No external solves yet.')).toBeVisible();

	const pingBody = JSON.stringify({
		zen: 'Practicality beats purity.',
		hook_id: 664583058
	});
	const pingSignature = `sha256=${createHmac('sha256', 'e2e-webhook-secret')
		.update(pingBody)
		.digest('hex')}`;
	const pingResponse = await page.request.post(
		'/api/integrations/github/neetcode',
		{
			data: pingBody,
			headers: {
				'content-type': 'application/json',
				'x-github-event': 'ping',
				'x-hub-signature-256': pingSignature
			}
		}
	);
	expect(pingResponse.status()).toBe(200);
	expect(await pingResponse.json()).toEqual({ ok: true, event: 'ping' });

	const webhookBody = JSON.stringify({
		repository: {
			full_name: 'lutefd/neetcode-submissions',
			default_branch: 'main'
		},
		ref: 'refs/heads/main',
		commits: [
			{
				id: 'e2e-commit',
				committer: { date: '2026-08-11T12:00:00.000Z' },
				added: ['Data Structures & Algorithms/two-sum/submission-0.go']
			}
		]
	});
	const signature = `sha256=${createHmac('sha256', 'e2e-webhook-secret')
		.update(webhookBody)
		.digest('hex')}`;
	const response = await page.request.post(
		'/api/integrations/github/neetcode',
		{
			data: webhookBody,
			headers: {
				'content-type': 'application/json',
				'x-github-event': 'push',
				'x-hub-signature-256': signature
			}
		}
	);
	expect(response.ok()).toBe(true);
	expect(await response.json()).toMatchObject({ imported: 1 });
	const redelivery = await page.request.post(
		'/api/integrations/github/neetcode',
		{
			data: webhookBody,
			headers: {
				'content-type': 'application/json',
				'x-github-event': 'push',
				'x-hub-signature-256': signature
			}
		}
	);
	expect(await redelivery.json()).toMatchObject({ imported: 0, updated: 1 });

	await page.goto('/problems');
	await expect(page).toHaveTitle('Problems | AlgoDrill');
	await expect(page.locator('[aria-label="Problem list"]')).toHaveClass(
		/overflow-y-auto/
	);
	await expect(page.getByText('NeetCode', { exact: true })).toBeVisible();
	const problemHref = await page
		.locator('a[href^="/problems/"]')
		.first()
		.getAttribute('href');
	expect(problemHref).toBeTruthy();
	await page
		.getByLabel('Problem URL')
		.fill('https://www.hackerrank.com/challenges/solve-me-first/problem');
	await page.getByRole('button', { name: 'Add problem' }).click();
	await expect(page.getByText('HackerRank', { exact: true })).toBeVisible();

	await page.goto('/history');
	await expect(page).toHaveTitle('History | AlgoDrill');
	await expect(page.getByText('Two Sum')).toBeVisible();
	await expect(page.getByText('two-sum', { exact: false })).toBeVisible();
	await expect(page.getByRole('link', { name: 'View source' })).toHaveAttribute(
		'href',
		'https://github.com/lutefd/neetcode-submissions/blob/e2e-commit/Data%20Structures%20%26%20Algorithms/two-sum/submission-0.go'
	);

	await page.goto(problemHref!);
	await expect(page).toHaveTitle('Two Sum | Problems | AlgoDrill');
	await expect(page.getByText('NeetCode', { exact: true })).toBeVisible();
	await expect(
		page.getByText('No timed attempts for this problem yet.')
	).toBeVisible();
	await expect(page.getByText('Go', { exact: true })).toBeVisible();

	await page.goto('/sessions/new');
	await expect(page).toHaveTitle('New session | AlgoDrill');
	const problemId = problemHref!.split('/').pop();
	await page.locator(`input[name="problemIds"][value="${problemId}"]`).check();
	await page.getByLabel('Name').fill('Hash map warmup');
	await page.getByRole('button', { name: 'Create briefing' }).click();
	await expect(
		page.getByRole('heading', { name: 'Hash map warmup', exact: true })
	).toBeVisible();
	await page.waitForURL(/\/sessions\/(?!new$)[^/?]+$/);
	await page.getByRole('button', { name: 'Acknowledge and start' }).click();
	await expect(page.getByLabel('Problem URL')).toBeVisible();
	await page
		.locator('.rich-editor-notebook .ProseMirror')
		.pressSequentially('Session brief notes.');
	await page
		.getByLabel('Problem URL')
		.fill('https://www.hackerrank.com/challenges/compare-the-triplets/problem');
	await page.getByRole('button', { name: 'Add problem' }).click();
	await expect(page.getByText('HackerRank', { exact: true })).toBeVisible();
	await page
		.locator('article')
		.filter({ hasText: 'Two Sum' })
		.getByRole('button', { name: 'Work' })
		.click();
	await page.waitForTimeout(1000);

	const linkedSubmittedAt = new Date().toISOString();
	const linkedWebhookBody = JSON.stringify({
		repository: {
			full_name: 'lutefd/neetcode-submissions',
			default_branch: 'main'
		},
		ref: 'refs/heads/main',
		commits: [
			{
				id: 'e2e-linked-commit',
				committer: { date: linkedSubmittedAt },
				added: ['Data Structures & Algorithms/two-sum/submission-1.go']
			}
		]
	});
	const linkedSignature = `sha256=${createHmac('sha256', 'e2e-webhook-secret')
		.update(linkedWebhookBody)
		.digest('hex')}`;
	const linkedResponse = await page.request.post(
		'/api/integrations/github/neetcode',
		{
			data: linkedWebhookBody,
			headers: {
				'content-type': 'application/json',
				'x-github-event': 'push',
				'x-hub-signature-256': linkedSignature
			}
		}
	);
	expect(await linkedResponse.json()).toMatchObject({ imported: 1 });

	await page.getByRole('button', { name: 'Stop work' }).click();
	await page.getByRole('button', { name: 'Finish session / recap' }).click();
	await page.waitForURL(/\/sessions\/[^/]+\/recap$/);
	await page
		.locator('select[name^="outcome:"]')
		.selectOption('solved_independently');
	await page.locator('select[name^="confidence:"]').selectOption('4');
	await page
		.locator('.rich-editor-recap .ProseMirror')
		.pressSequentially('Recap solution notes.');
	await page.getByRole('button', { name: 'Save recap' }).click();
	await page.waitForURL(/\/sessions\/[^/]+$/);
	await expect(page.locator('main')).toHaveCount(1);
	await expect(
		page.getByRole('heading', { name: 'Session recap', exact: true })
	).toHaveCount(0);
	await expect(page.getByText('completed', { exact: true })).toHaveCount(1);
	await expect(page.getByText('Recap solution notes.')).toBeVisible();
	await expect(page.getByText('Session brief notes.')).toBeVisible();

	await page.goto('/history');
	const groupedHistoryItem = page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Activity' }) })
		.locator('article')
		.filter({ hasText: 'Accepted NeetCode solve' })
		.filter({ hasText: 'Timed attempt' });
	await expect(groupedHistoryItem).toHaveCount(1);
	await expect(groupedHistoryItem.getByText('View source')).toHaveAttribute(
		'href',
		'https://github.com/lutefd/neetcode-submissions/blob/e2e-linked-commit/Data%20Structures%20%26%20Algorithms/two-sum/submission-1.go'
	);
	await expect(groupedHistoryItem).toContainText(/\d+m \d+s/);
	await expect(groupedHistoryItem).toContainText('confidence 4');
	await expect(
		groupedHistoryItem.getByText('Recap solution notes.')
	).toBeVisible();
});
