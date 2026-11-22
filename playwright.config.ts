import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const e2eDatabasePath = resolve('.data/algodrill-e2e.sqlite');

export default defineConfig({
	testDir: 'tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: false,
	workers: 1,
	webServer: {
		command:
			'npm run db:migrate && npm run build && npm run preview -- --host 127.0.0.1',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		env: {
			DATABASE_PATH: e2eDatabasePath,
			NODE_ENV: 'development',
			BETTER_AUTH_URL: 'http://127.0.0.1:4173',
			BETTER_AUTH_SECRET: 'e2e-algodrill-secret-1234567890123456',
			SETUP_TOKEN: 'development-setup-token',
			NEETCODE_GITHUB_REPOSITORY: 'lutefd/neetcode-submissions',
			NEETCODE_IMPORT_USER_EMAIL: 'owner@example.com',
			GITHUB_WEBHOOK_SECRET: 'e2e-webhook-secret'
		}
	},
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
