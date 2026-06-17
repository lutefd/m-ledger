<script lang="ts">
	import {
		CalendarDays,
		History,
		ListChecks,
		NotebookPen,
		Pause,
		Play,
		TriangleAlert
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { formatDuration } from '$lib/utils/time';

	let { data, children } = $props();
	let barElapsed = $state(data.openSession?.elapsedMs ?? 0);

	const nav = [
		{ route: '/(app)/today', label: 'Today', icon: CalendarDays },
		{ route: '/(app)/problems', label: 'Problems', icon: ListChecks },
		{ route: '/(app)/mistakes', label: 'Mistakes', icon: TriangleAlert },
		{ route: '/(app)/patterns', label: 'Patterns', icon: NotebookPen },
		{ route: '/(app)/history', label: 'History', icon: History }
	] as const;

	$effect(() => {
		barElapsed = data.openSession?.elapsedMs ?? 0;
		if (
			data.openSession?.status !== 'active' ||
			!data.openSession.openSegmentStartedAt
		)
			return;
		const startedAt = new Date(data.openSession.openSegmentStartedAt).getTime();
		const base =
			(data.openSession.elapsedMs ?? 0) - Math.max(0, Date.now() - startedAt);
		const interval = window.setInterval(() => {
			barElapsed = base + Math.max(0, Date.now() - startedAt);
		}, 1000);
		return () => window.clearInterval(interval);
	});
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

	{#if data.openSession}
		<section class="border-b border-line bg-white">
			<div
				class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm"
			>
				<div>
					<p class="font-semibold">
						{data.openSession.status === 'briefing'
							? 'Briefing ready'
							: data.openSession.status === 'paused'
								? 'Session paused'
								: (data.openSession.currentProblemTitle ?? 'Session active')}
					</p>
					{#if data.openSession.status === 'active'}
						<p class="text-muted tabular-nums">{formatDuration(barElapsed)}</p>
					{/if}
				</div>
				<div class="flex gap-2">
					{#if data.openSession.status === 'active'}
						<form
							method="POST"
							action={`/sessions/${data.openSession.id}?/pause`}
							use:enhance
						>
							<button
								class="inline-flex items-center gap-2 rounded border border-line px-3 py-2"
								type="submit"><Pause size={16} />Pause</button
							>
						</form>
					{/if}
					<a
						class="inline-flex items-center gap-2 rounded bg-accent px-3 py-2 font-semibold text-white"
						href={`/sessions/${data.openSession.id}`}
					>
						<Play size={16} aria-hidden="true" />
						{data.openSession.status === 'briefing'
							? 'Open session'
							: data.openSession.status === 'paused'
								? 'Resume'
								: 'Return to session'}
					</a>
				</div>
			</div>
		</section>
	{/if}

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
