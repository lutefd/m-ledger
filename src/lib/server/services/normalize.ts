export function normalizeName(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function titleFromSlug(slug: string): string {
	return slug
		.split('-')
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
