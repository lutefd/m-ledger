<script lang="ts">
	import {
		CalendarDays,
		History,
		ListChecks,
		NotebookPen,
		TriangleAlert
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	const nav = [
		{ route: '/(app)/today', label: 'Today', icon: CalendarDays },
		{ route: '/(app)/problems', label: 'Problems', icon: ListChecks },
		{ route: '/(app)/mistakes', label: 'Mistakes', icon: TriangleAlert },
		{ route: '/(app)/patterns', label: 'Patterns', icon: NotebookPen },
		{ route: '/(app)/history', label: 'History', icon: History }
	] as const;
</script>

<div class="min-h-screen pb-20 md:pb-0">
	<header class="border-b border-line bg-paper/95">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href={resolve('/(app)/today')} class="text-lg font-semibold"
				>Mistake Ledger</a
			>
			<nav
				class="hidden items-center gap-2 md:flex"
				aria-label="Main navigation"
			>
				{#each nav as item (item.route)}
					<a
						class="rounded px-3 py-2 text-sm text-muted hover:bg-white/70 hover:text-ink"
						href={resolve(item.route)}>{item.label}</a
					>
				{/each}
			</nav>
			<p class="hidden text-sm text-muted md:block">{data.user?.email}</p>
		</div>
	</header>

	{@render children()}

	<nav
		class="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-line bg-paper md:hidden"
		aria-label="Mobile navigation"
	>
		{#each nav as item (item.route)}
			{@const Icon = item.icon}
			<a
				class="flex flex-col items-center gap-1 px-2 py-3 text-xs text-muted"
				href={resolve(item.route)}
			>
				<Icon size={18} aria-hidden="true" />
				<span>{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
