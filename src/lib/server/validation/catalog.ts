import { z } from 'zod';

export const problemInputSchema = z.object({
	url: z.url('Enter a valid LeetCode URL.'),
	title: z.string().max(180).optional(),
	difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
	topics: z.string().optional()
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
