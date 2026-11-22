<script lang="ts">
	import {
		CalendarDays,
		History,
		ListChecks,
		Monitor,
		Moon,
		NotebookPen,
		PanelLeft,
		Pause,
		Play,
		Sun,
		TriangleAlert
	} from '@lucide/svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { enhanceWithToast } from '$lib/utils/forms';
	import { formatClock } from '$lib/utils/time';
	import {
		cycleTheme,
		preferences,
		toggleSidebar
	} from '$lib/ui/preferences.svelte';

	let { data, children } = $props();
	let barElapsed = $state(data.openSession?.elapsedMs ?? 0);

	const nav = [
		{ route: '/(app)/today', label: 'Today', icon: CalendarDays },
		{ route: '/(app)/problems', label: 'Problems', icon: ListChecks },
		{ route: '/(app)/mistakes', label: 'Mistakes', icon: TriangleAlert },
		{ route: '/(app)/patterns', label: 'Patterns', icon: NotebookPen },
		{ route: '/(app)/history', label: 'History', icon: History }
	] as const;

	const themeMeta = {
		system: { label: 'System theme', icon: Monitor },
		light: { label: 'Light theme', icon: Sun },
		dark: { label: 'Dark theme', icon: Moon }
	} as const;

	const theme = $derived(
		themeMeta[browser ? preferences.theme : data.preferences.theme]
	);
	const sidebar = $derived(
		browser ? preferences.sidebar : data.preferences.sidebar
	);
	const session = $derived(data.openSession);
	const sessionHref = $derived(session ? `/sessions/${session.id}` : '');
	const onSessionPage = $derived(page.url.pathname === sessionHref);
	const sessionLabel = $derived(
		session?.status === 'briefing'
			? 'Briefing ready'
			: session?.status === 'paused'
				? 'Session paused'
				: (session?.currentProblemTitle ?? 'Session active')
	);
	const sessionAction = $derived(
		session?.status === 'briefing'
			? 'Open session'
			: session?.status === 'paused'
				? 'Resume'
				: 'Return to session'
	);

	function isCurrent(route: (typeof nav)[number]['route']) {
		const href = resolve(route);
		return (
			page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
		);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'b' || !(event.metaKey || event.ctrlKey)) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, [contenteditable="true"]'))
			return;
		event.preventDefault();
		toggleSidebar();
	}

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

<svelte:window onkeydown={onKeydown} />

{#snippet pauseForm(className: string, iconOnly: boolean)}
	{#if session?.status === 'active'}
		<form
			class="contents"
			method="POST"
			action={`/sessions/${session.id}?/pause`}
			use:enhance={enhanceWithToast}
		>
			<button
				class={className}
				type="submit"
				aria-label={iconOnly ? 'Pause' : undefined}
			>
				<Pause size={14} aria-hidden="true" />
				{#if !iconOnly}Pause{/if}
			</button>
		</form>
	{/if}
{/snippet}

<div
	class="min-h-screen md:grid md:grid-cols-[auto_1fr]"
	data-sidebar={sidebar}
>
	<!-- Desktop sidebar -->
	<aside
		class="sticky top-0 hidden h-screen w-56 flex-col border-r border-line bg-sidebar px-2.5 py-4 md:flex collapsed:w-14 collapsed:items-center collapsed:px-2"
	>
		<a
			href={resolve('/(app)/today')}
			class="mb-5 flex items-center gap-2 px-2 text-[0.95rem] font-semibold tracking-tight collapsed:px-0"
			aria-label="AlgoDrill"
		>
			<span
				class="grid size-7 shrink-0 place-items-center rounded-md bg-fg text-sm font-bold text-bg"
				aria-hidden="true">A</span
			>
			<span class="collapsed:hidden">AlgoDrill</span>
		</a>

		<nav class="flex flex-col gap-0.5" aria-label="Main navigation">
			{#each nav as item (item.route)}
				{@const Icon = item.icon}
				{@const current = isCurrent(item.route)}
				<a
					class={[
						'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors collapsed:size-9 collapsed:justify-center collapsed:px-0',
						current
							? 'bg-nav-on font-medium text-fg shadow-[0_0_0_1px_var(--nav-ring)]'
							: 'text-muted hover:bg-hover hover:text-fg'
					]}
					aria-current={current ? 'page' : undefined}
					href={resolve(item.route)}
				>
					<Icon size={16} aria-hidden="true" />
					<span
						class="collapsed:pointer-events-none collapsed:absolute collapsed:left-full collapsed:z-20 collapsed:ml-2 collapsed:hidden collapsed:rounded collapsed:bg-fg collapsed:px-2 collapsed:py-0.5 collapsed:text-xs collapsed:font-normal collapsed:whitespace-nowrap collapsed:text-bg collapsed:group-hover:block collapsed:group-focus-visible:block"
						>{item.label}</span
					>
				</a>
			{/each}
		</nav>

		<div class="mt-auto flex flex-col gap-3 collapsed:items-center">
			{#if session}
				<!-- Expanded: session card -->
				<section
					class="rounded-lg border border-line bg-surface p-3 collapsed:hidden"
					aria-label="Open session"
				>
					{#if session.name}
						<p class="truncate text-sm font-medium">{session.name}</p>
					{/if}
					<p class="truncate text-xs text-muted">{sessionLabel}</p>
					{#if session.status === 'active'}
						<p
							class="mt-0.5 font-mono text-2xl font-medium tracking-tight text-live tabular-nums"
						>
							{formatClock(barElapsed)}
						</p>
					{/if}
					<div class="mt-2.5 flex flex-col gap-1.5">
						{#if !onSessionPage}
							<a class="btn btn-primary" href={sessionHref}>
								<Play size={14} aria-hidden="true" />
								{sessionAction}
							</a>
						{/if}
						{@render pauseForm('btn btn-secondary', false)}
					</div>
				</section>
				<!-- Collapsed: vertical clock -->
				<a
					href={sessionHref}
					class="hidden flex-col items-center gap-1.5 border-y border-line py-2 font-mono text-[0.7rem] text-live collapsed:flex"
					aria-label={`${sessionLabel}: ${sessionAction}`}
				>
					<span class="size-1.5 rounded-full bg-live" aria-hidden="true"></span>
					{#if session.status === 'active'}
						<span class="rotate-180 tabular-nums [writing-mode:vertical-rl]"
							>{formatClock(barElapsed)}</span
						>
					{:else}
						<Play size={14} aria-hidden="true" />
					{/if}
				</a>
			{/if}

			<div class="flex items-center gap-1 collapsed:flex-col">
				<button
					type="button"
					class="btn btn-ghost btn-icon"
					onclick={cycleTheme}
					aria-label={`${theme.label}. Switch theme`}
					title={theme.label}
				>
					<theme.icon size={16} aria-hidden="true" />
				</button>
				<button
					type="button"
					class="btn btn-ghost btn-icon"
					onclick={toggleSidebar}
					aria-label="Toggle sidebar"
					title="Toggle sidebar (Ctrl+B)"
				>
					<PanelLeft size={16} aria-hidden="true" />
				</button>
				<p
					class="ml-auto truncate text-xs text-faint collapsed:hidden"
					title={data.user?.email}
				>
					{data.user?.email}
				</p>
			</div>
		</div>
	</aside>

	<div class="min-w-0 pb-36 md:pb-0">
		<!-- Phone top bar -->
		<header
			class="flex items-center justify-between border-b border-line px-4 py-2.5 md:hidden"
		>
			<a
				href={resolve('/(app)/today')}
				class="text-[0.95rem] font-semibold tracking-tight">AlgoDrill</a
			>
			<button
				type="button"
				class="btn btn-ghost btn-icon"
				onclick={cycleTheme}
				aria-label={`${theme.label}. Switch theme`}
			>
				<theme.icon size={16} aria-hidden="true" />
			</button>
		</header>

		{@render children()}
	</div>

	<!-- Phone: session pill + tab bar -->
	<div class="fixed inset-x-0 bottom-0 z-10 md:hidden">
		{#if session && !onSessionPage}
			<section
				class="mx-2.5 mb-2 flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-3 shadow-lg shadow-black/10"
				aria-label="Open session"
			>
				<p class="min-w-0 flex-1 truncate text-xs text-muted">
					{sessionLabel}
				</p>
				{#if session.status === 'active'}
					<p class="font-mono text-sm font-medium text-live tabular-nums">
						{formatClock(barElapsed)}
					</p>
				{/if}
				{@render pauseForm('btn btn-secondary btn-icon size-8', true)}
				<a
					class="btn btn-primary btn-icon size-8"
					href={sessionHref}
					aria-label={sessionAction}
				>
					<Play size={14} aria-hidden="true" />
				</a>
			</section>
		{/if}
		<nav
			class="grid grid-cols-5 border-t border-line bg-sidebar pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
			aria-label="Mobile navigation"
		>
			{#each nav as item (item.route)}
				{@const Icon = item.icon}
				{@const current = isCurrent(item.route)}
				<a
					class={[
						'flex flex-col items-center gap-0.5 text-[0.68rem]',
						current ? 'font-medium text-fg' : 'text-faint'
					]}
					aria-current={current ? 'page' : undefined}
					href={resolve(item.route)}
				>
					<Icon
						size={18}
						class={current ? 'text-live' : undefined}
						aria-hidden="true"
					/>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	</div>
</div>
