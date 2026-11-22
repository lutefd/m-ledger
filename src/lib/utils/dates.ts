/** App calendar timezone (compose sets TZ=America/Sao_Paulo). */
export const APP_TIMEZONE = process.env.TZ || 'America/Sao_Paulo';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoNow(date = new Date()): string {
	return date.toISOString();
}

export function dateOnly(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

export function localDateOnly(
	date = new Date(),
	timeZone = APP_TIMEZONE
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

export function isValidDateOnly(value: string): boolean {
	if (!DATE_ONLY_RE.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(parsed.getTime()) && dateOnly(parsed) === value;
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
