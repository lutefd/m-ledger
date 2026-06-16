import { defineConfig } from 'drizzle-kit';

const databasePath = process.env.DATABASE_PATH ?? '/data/mistake-ledger.sqlite';

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: databasePath
	},
	strict: true,
	verbose: true
});
