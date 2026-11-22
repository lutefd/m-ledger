import type { LayoutServerLoad } from './$types';
import { parsePreferences } from '$lib/ui/preferences';

export const load: LayoutServerLoad = ({ cookies }) => ({
	preferences: parsePreferences((name) => cookies.get(name))
});
