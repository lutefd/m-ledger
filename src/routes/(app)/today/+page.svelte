<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Today | Mistake Ledger</title>
</svelte:head>

<main class="mx-auto max-w-6xl space-y-8 px-6 py-8">
	<section class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-accent">
			Today
		</p>
		<h1 class="text-3xl font-semibold">Start with the mistakes that repeat.</h1>
		<a
			class="inline-flex rounded bg-accent px-4 py-2 font-semibold text-white"
			href="/sessions/new">New session</a
		>
	</section>

	<section class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
		<div class="rounded-lg border border-line bg-white/55 p-5">
			<h2 class="text-xl font-semibold">Recurring mistakes</h2>
			{#if data.mistakes.length === 0}
				<p class="mt-3 text-muted">
					Your next session briefing will appear here once attempts have enough
					history.
				</p>
			{:else}
				<div class="mt-4 space-y-3">
					{#each data.mistakes as mistake (mistake.rank)}
						<article class="border-t border-line pt-3">
							<h3 class="font-semibold">{mistake.name}</h3>
							<p class="text-sm text-muted">
								{mistake.guardrail ?? 'No guardrail recorded yet.'}
							</p>
							<p class="mt-1 text-xs text-muted">
								{mistake.occurrenceCount} occurrences, last seen {mistake.lastOccurrence.slice(
									0,
									10
								)}
							</p>
						</article>
					{/each}
				</div>
			{/if}
		</div>
		<div class="rounded-lg border border-line bg-white/55 p-5">
			<h2 class="text-xl font-semibold">Due redos</h2>
			{#if data.redos.length === 0}
				<p class="mt-3 text-muted">
					Problems with due redo dates will be queued here.
				</p>
			{:else}
				<ul class="mt-4 space-y-2">
					{#each data.redos as redo (redo.rank)}
						<li>
							<a
								class="font-medium underline"
								href={redo.url}
								target="_blank"
								rel="noreferrer noopener">{redo.title}</a
							>
							<span class="text-sm text-muted">due {redo.dueDate}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<section class="rounded-lg border border-line bg-white/55 p-5">
		<h2 class="text-xl font-semibold">Recent sessions</h2>
		{#if data.recent.length === 0}
			<p class="mt-3 text-muted">No sessions yet.</p>
		{:else}
			<div class="mt-4 divide-y divide-line">
				{#each data.recent as session (session.id)}
					<a
						class="flex items-center justify-between py-3"
						href={`/sessions/${session.id}`}
					>
						<span>{session.startedAt.slice(0, 10)}</span>
						<span class="text-sm text-muted">{session.status}</span>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</main>
