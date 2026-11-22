import {
	SIDEBAR_COOKIE,
	THEME_COOKIE,
	THEMES,
	type Preferences,
	type Sidebar,
	type Theme
} from './preferences';

export const preferences = $state<Preferences>({
	theme: 'system',
	sidebar: 'auto'
});

const WIDE_QUERY = '(min-width: 64rem)';

function persist(name: string, value: string) {
	document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function setTheme(theme: Theme) {
	preferences.theme = theme;
	document.documentElement.dataset.theme = theme;
	persist(THEME_COOKIE, theme);
}

export function cycleTheme() {
	setTheme(THEMES[(THEMES.indexOf(preferences.theme) + 1) % THEMES.length]);
}

export function sidebarIsCollapsed(sidebar: Sidebar) {
	if (sidebar === 'auto') return !window.matchMedia(WIDE_QUERY).matches;
	return sidebar === 'collapsed';
}

export function toggleSidebar() {
	const next = sidebarIsCollapsed(preferences.sidebar)
		? 'expanded'
		: 'collapsed';
	preferences.sidebar = next;
	persist(SIDEBAR_COOKIE, next);
}
