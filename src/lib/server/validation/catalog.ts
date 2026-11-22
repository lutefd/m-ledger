import { z } from 'zod';

const optionalFormString = z.preprocess(
	(value) => (value === '' ? undefined : value),
	z.string().optional()
);

export const problemInputSchema = z.object({
	url: z.url('Enter a valid HTTPS problem URL.').refine((value) => {
		try {
			return new URL(value).protocol === 'https:';
		} catch {
			return false;
		}
	}, 'Problem URLs must use HTTPS.'),
	title: optionalFormString.pipe(z.string().max(180).optional()),
	difficulty: z.preprocess(
		(value) => (value === '' ? undefined : value),
		z.enum(['easy', 'medium', 'hard']).optional()
	),
	topics: optionalFormString
});

export const mistakeInputSchema = z.object({
	name: z.string().min(1, 'Name is required.').max(120),
	description: z.string().max(1000).optional(),
	guardrail: z.string().max(1000).optional()
});

export const patternInputSchema = z.object({
	name: z.string().min(1, 'Name is required.').max(120),
	recognitionTrigger: z.string().max(1000).optional()
});
