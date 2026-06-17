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
	redoDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.or(z.literal(''))
		.optional(),
	mistakeIds: z.array(z.string()).default([]),
	patternIds: z.array(z.string()).default([])
});

export const recapSchema = z
	.array(
		recapAttemptSchema.extend({
			mistakeIds: z
				.array(z.string())
				.refine(
					(ids) => new Set(ids).size === ids.length,
					'Choose each mistake at most once.'
				),
			patternIds: z
				.array(z.string())
				.refine(
					(ids) => new Set(ids).size === ids.length,
					'Choose each pattern at most once.'
				)
		})
	)
	.min(1, 'Activate at least one problem before recapping.')
	.refine(
		(inputs) =>
			new Set(inputs.map((input) => input.attemptId)).size === inputs.length,
		'Each attempt can only be recapped once.'
	);

export type RecapInput = z.infer<typeof recapSchema>;
