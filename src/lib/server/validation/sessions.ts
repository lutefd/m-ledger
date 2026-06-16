import { z } from 'zod';

export const newSessionSchema = z.object({
	problemIds: z.array(z.string()).min(1)
});

export const recapAttemptSchema = z.object({
	attemptId: z.string(),
	outcome: z.enum([
		'solved_independently',
		'solved_with_help',
		'partial',
		'stuck'
	]),
	confidence: z.coerce.number().int().min(1).max(5),
	notes: z.string().optional(),
	redoDate: z.string().optional(),
	mistakeIds: z.array(z.string()).default([]),
	patternIds: z.array(z.string()).default([])
});
