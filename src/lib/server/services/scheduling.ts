import { addDaysToDateOnly, localDateOnly } from '$lib/utils/dates';

const intervals: Record<number, number> = {
	1: 1,
	2: 3,
	3: 7,
	4: 14,
	5: 30
};

export function suggestRedoDate(
	confidence: number,
	completedAt: Date | string = new Date()
): string {
	const days = intervals[confidence];
	if (!days) throw new Error('Confidence must be between 1 and 5.');
	const base =
		typeof completedAt === 'string' ? completedAt : localDateOnly(completedAt);
	return addDaysToDateOnly(base, days);
}
