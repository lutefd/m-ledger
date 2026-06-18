import { z } from 'zod';

const nodeEnv = process.env.NODE_ENV ?? 'development';

const envSchema = z.object({
	DATABASE_PATH: z.string().min(1).default('.data/algodrill.sqlite'),
	BETTER_AUTH_SECRET: z
		.string()
		.min(32)
		.default(
			nodeEnv === 'production'
				? 'algodrill_prod_build_placeholder_replace_in_runtime'
				: 'algodrill_dev_local_secret_9f3a7c6d2b1e4a8c0f5d6e7b'
		),
	BETTER_AUTH_URL: z.url().default('http://localhost:5173'),
	SETUP_TOKEN: z
		.string()
		.min(16)
		.default(nodeEnv === 'production' ? '' : 'development-setup-token'),
	EXPORT_API_TOKEN: z.string().min(32).optional(),
	EXPORT_API_USER_EMAIL: z.email().optional(),
	NODE_ENV: z.enum(['development', 'test', 'production']).default('development')
});

export type ServerEnv = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
