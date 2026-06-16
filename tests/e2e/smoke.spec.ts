import { expect, test } from '@playwright/test';

test('redirects unauthenticated users to login or setup', async ({ page }) => {
	await page.goto('/today');
	await expect(page).toHaveURL(/\/(login|setup)$/);
});
