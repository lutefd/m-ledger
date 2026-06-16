import { getRequestEvent } from '$app/server';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db/client';
import * as schema from '$lib/server/db/schema';
import { env } from '$lib/server/env';

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema,
		usePlural: true
	}),
	emailAndPassword: {
		enabled: true,
		disableSignUp: false
	},
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 60
		}
	},
	advanced: {
		cookiePrefix: 'mistake-ledger',
		useSecureCookies: env.NODE_ENV === 'production'
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});
