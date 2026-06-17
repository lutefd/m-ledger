export function isoNow(date = new Date()): string {
	return date.toISOString();
}

export function dateOnly(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

export function localDateOnly(
	date = new Date(),
	timeZone = process.env.TZ ?? 'UTC'
): string {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const value = (type: string) =>
		parts.find((part) => part.type === type)?.value ?? '';
	return `${value('year')}-${value('month')}-${value('day')}`;
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

export function addDaysToDateOnly(date: string, days: number): string {
	const [year, month, day] = date.split('-').map(Number);
	const next = new Date(Date.UTC(year, month - 1, day));
	next.setUTCDate(next.getUTCDate() + days);
	return dateOnly(next);
}
