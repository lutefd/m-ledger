import { z } from 'zod';

const envSchema = z.object({
	DATABASE_PATH: z.string().min(1).default('/data/mistake-ledger.sqlite'),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url().optional(),
	SETUP_TOKEN: z.string().min(16),
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export type ServerEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
