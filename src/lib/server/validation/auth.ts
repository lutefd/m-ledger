import { z } from 'zod';

export const setupSchema = z.object({
	token: z.string().min(1, 'Setup token is required.'),
	name: z.string().min(1, 'Name is required.').max(120),
	email: z.email('Enter a valid email address.'),
	password: z.string().min(12, 'Use at least 12 characters.')
});

export const loginSchema = z.object({
	email: z.email('Enter a valid email address.'),
	password: z.string().min(1, 'Password is required.')
});
