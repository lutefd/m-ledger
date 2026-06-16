<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, Pause, Play, Save, Trash2 } from '@lucide/svelte';
	import { formatDuration } from '$lib/utils/time';

	let { data, form } = $props();
	const notebookPlaceholder =
		'## Session log\n\n- Approach:\n- Mistakes:\n- Next guardrail:';
	const openSegment = $derived(
		data.segments.find((segment) => !segment.endedAt)
	);
	let renderedElapsed = $state(0);

	$effect(() => {
		renderedElapsed = data.elapsedMs;
		if (!openSegment) return;
		const startedAt = new Date(openSegment.startedAt).getTime();
		const base = data.elapsedMs - Math.max(0, Date.now() - startedAt);
		const interval = window.setInterval(() => {
			renderedElapsed = base + Math.max(0, Date.now() - startedAt);
		}, 1000);
		return () => window.clearInterval(interval);
	});

	function confirmDelete(event: SubmitEvent) {
		if (
			!window.confirm(
				'Delete this session and all related attempts, timer segments, and briefing snapshots?'
			)
		) {
			event.preventDefault();
		}
	}
</script>

<main class="mx-auto max-w-6xl space-y-6 px-6 py-8">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<p class="text-sm font-semibold uppercase tracking-wide text-accent">
				Session
			</p>
			<h1 class="text-3xl font-semibold capitalize">{data.session.status}</h1>
		</div>
		<div class="text-3xl font-semibold tabular-nums">
			{formatDuration(renderedElapsed)}
		</div>
	</div>
	{#if form?.message}
		<p
			class={`rounded border px-3 py-2 text-sm ${form.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}
		>
			{form.message}
		</p>
	{/if}

	{#if data.session.status === 'briefing'}
		<section class="grid gap-4 lg:grid-cols-2">
			<div class="rounded-lg border border-line bg-white/60 p-5">
				<h2 class="text-xl font-semibold">Recurring mistakes</h2>
				{#if data.briefingMistakes.length === 0}
					<p class="mt-3 text-muted">No recurring mistakes qualified yet.</p>
				{:else}
					{#each data.briefingMistakes as mistake (mistake.rank)}
						<article class="mt-4 border-t border-line pt-4">
							<h3 class="font-semibold">{mistake.name}</h3>
							<p class="text-sm text-muted">
								{mistake.guardrail ?? 'No guardrail recorded.'}
							</p>
							<p class="mt-1 text-xs text-muted">
								{mistake.occurrenceCount} occurrences
							</p>
						</article>
					{/each}
				{/if}
			</div>
			<div class="rounded-lg border border-line bg-white/60 p-5">
				<h2 class="text-xl font-semibold">Due redos</h2>
				{#if data.briefingRedos.length === 0}
					<p class="mt-3 text-muted">No redos due.</p>
				{:else}
					{#each data.briefingRedos as redo (redo.rank)}
						<p class="mt-3">
							{redo.title}
							<span class="text-sm text-muted">{redo.dueDate}</span>
						</p>
					{/each}
				{/if}
			</div>
		</section>
		<form method="POST" action="?/acknowledge" use:enhance>
			<button
				class="rounded bg-accent px-4 py-2 font-semibold text-white"
				type="submit">Acknowledge and start</button
			>
		</form>
	{:else}
		<section class="rounded-lg border border-line bg-white/60 p-5">
			<h2 class="text-xl font-semibold">Queue</h2>
			<div class="mt-4 space-y-3">
				{#each data.queue as item (item.problemId)}
					<article
						class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"
					>
						<div>
							<h3 class="font-semibold">{item.title}</h3>
							<p class="text-sm text-muted">{item.outcome ?? 'Not recapped'}</p>
						</div>
						<div class="flex gap-2">
							<a
								class="rounded border border-line px-3 py-2 text-sm"
								href={item.url}
								target="_blank"
								rel="noreferrer noopener"
								aria-label={`Open ${item.title}`}
							>
								<ExternalLink size={16} aria-hidden="true" />
							</a>
							<form method="POST" action="?/activate" use:enhance>
								<input type="hidden" name="problemId" value={item.problemId} />
								<button
									class="inline-flex items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-semibold text-white"
									type="submit"
								>
									<Play size={16} aria-hidden="true" />
									{openSegment?.attemptId === item.attemptId
										? 'Active'
										: 'Work'}
								</button>
							</form>
						</div>
					</article>
				{/each}
			</div>
		</section>
		<div class="flex gap-3">
			<form method="POST" action="?/pause" use:enhance>
				<button
					class="inline-flex items-center gap-2 rounded border border-line px-4 py-2"
					type="submit"><Pause size={16} />Pause</button
				>
			</form>
			<form method="POST" action="?/complete">
				<button
					class="rounded bg-ink px-4 py-2 font-semibold text-white"
					type="submit">Recap</button
				>
			</form>
		</div>
	{/if}

	<section class="rounded-lg border border-line bg-white/60 p-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 class="text-xl font-semibold">Notebook</h2>
				<p class="mt-1 text-sm text-muted">Markdown notes for this session.</p>
			</div>
			<form method="POST" action="?/delete" onsubmit={confirmDelete}>
				<button
					class="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
					type="submit"
				>
					<Trash2 size={16} aria-hidden="true" />
					Delete
				</button>
			</form>
		</div>
		<form method="POST" action="?/notes" use:enhance class="mt-4 space-y-3">
			<textarea
				name="notes"
				class="min-h-56 w-full rounded border border-line bg-white px-3 py-2 font-mono text-sm leading-6"
				placeholder={notebookPlaceholder}>{data.session.notes ?? ''}</textarea
			>
			<button
				class="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 font-semibold text-white"
				type="submit"
			>
				<Save size={16} aria-hidden="true" />
				Save notebook
			</button>
		</form>
	</section>
</main>
