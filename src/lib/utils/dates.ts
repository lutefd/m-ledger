export function isoNow(date = new Date()): string {
	return date.toISOString();
}

export function dateOnly(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}
