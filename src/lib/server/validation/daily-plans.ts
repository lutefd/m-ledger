import { z } from 'zod';

const leetCodeSlug = z
	.string()
	.trim()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid LeetCode slug.');

export const dailyPlanItemInputSchema = z
	.object({
		url: z.string().trim().url().optional(),
		slug: leetCodeSlug.optional(),
		title: z.string().trim().min(1).max(200).optional(),
		dueReason: z.string().trim().min(1).max(200),
		source: z.string().trim().min(1).max(100)
	})
	.refine((item) => Boolean(item.url || item.slug), {
		message: 'Each item needs a LeetCode url or slug.'
	});

export const upsertDailyPlanSchema = z.object({
	date: z
		.string()
		.trim()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'date must use YYYY-MM-DD.'),
	items: z.array(dailyPlanItemInputSchema).min(1).max(3)
});

export type UpsertDailyPlanInput = z.infer<typeof upsertDailyPlanSchema>;
export type DailyPlanItemInput = z.infer<typeof dailyPlanItemInputSchema>;
