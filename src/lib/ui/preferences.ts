export const THEMES = ['system', 'light', 'dark'] as const;
export const SIDEBARS = ['auto', 'expanded', 'collapsed'] as const;

export type Theme = (typeof THEMES)[number];
export type Sidebar = (typeof SIDEBARS)[number];
export type Preferences = { theme: Theme; sidebar: Sidebar };

export const THEME_COOKIE = 'algodrill-theme';
export const SIDEBAR_COOKIE = 'algodrill-sidebar';

function pick<T extends string>(
	options: readonly T[],
	value: string | undefined,
	fallback: T
): T {
	return options.find((option) => option === value) ?? fallback;
}

export function parsePreferences(
	read: (name: string) => string | undefined
): Preferences {
	return {
		theme: pick(THEMES, read(THEME_COOKIE), 'system'),
		sidebar: pick(SIDEBARS, read(SIDEBAR_COOKIE), 'auto')
	};
}
