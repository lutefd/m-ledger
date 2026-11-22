<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Today | AlgoDrill</title>
</svelte:head>

<main class="page">
	<header class="page-head">
		<div>
			<p class="page-sub">
				{new Date(`${data.planDate}T00:00:00Z`).toLocaleDateString('en-US', {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					timeZone: 'UTC'
				})}
			</p>
			<h1 class="page-title">Today</h1>
		</div>
		{#if data.openSession}
			<a
				class="btn btn-primary btn-lg"
				href={`/sessions/${data.openSession.id}`}>Resume open session</a
			>
		{:else}
			<a class="btn btn-primary btn-lg" href="/sessions/new">New session</a>
		{/if}
	</header>

	<div class="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
		<div class="min-w-0 space-y-8">
			<section>
				<div class="section-label">
					<h2 class="flex items-baseline gap-2">
						Bob's plan
						{#if data.plan}
							<span class="tag">{data.plan.items.length}</span>
						{/if}
						<span class="tag">{data.planDate}</span>
					</h2>
					{#if data.plan && !data.plan.started && !data.openSession}
						<form method="POST" action="?/startPlan" use:enhance>
							<button class="btn btn-secondary" type="submit"
								>Start from plan</button
							>
						</form>
					{:else if data.plan?.startedSessionId}
						<a
							class="btn btn-secondary"
							href={`/sessions/${data.plan.startedSessionId}`}
							>Open plan session</a
						>
					{/if}
				</div>

				{#if form?.message}
					<p class="form-error mb-2">{form.message}</p>
				{/if}

				{#if !data.plan}
					<p class="empty">No coach plan for today yet.</p>
				{:else}
					<ol class="panel rows">
						{#each data.plan.items as item, index (item.id)}
							<li
								class="row {index === 0 && !data.plan.started
									? 'row-live'
									: ''}"
							>
								<span class="w-5 shrink-0 font-mono text-sm text-faint"
									>{item.position}</span
								>
								<div class="min-w-0 flex-1">
									<a
										class="link font-medium"
										href={item.url}
										target="_blank"
										rel="noreferrer noopener">{item.title}</a
									>
									<p class="text-sm text-muted">{item.dueReason}</p>
								</div>
								<span class="tag shrink-0">{item.source}</span>
							</li>
						{/each}
					</ol>
					{#if data.plan.started}
						<p class="empty mt-2">This plan has already been started.</p>
					{/if}
				{/if}
			</section>

			<section>
				<h2 class="section-label">Recent sessions</h2>
				{#if data.recent.length === 0}
					<p class="empty">No sessions yet.</p>
				{:else}
					<div class="rows">
						{#each data.recent as session (session.id)}
							<a
								class="flex items-center justify-between gap-3 py-2.5 hover:bg-hover"
								href={`/sessions/${session.id}`}
							>
								<span class="flex min-w-0 items-baseline gap-3">
									<span class="shrink-0 font-mono text-sm"
										>{session.startedAt.slice(0, 10)}</span
									>
									{#if session.name}
										<span class="truncate text-sm font-medium"
											>{session.name}</span
										>
									{/if}
								</span>
								<span class="shrink-0 text-sm text-muted">{session.status}</span
								>
							</a>
						{/each}
					</div>
				{/if}
			</section>
		</div>

		<div class="min-w-0 space-y-8">
			<section>
				<h2 class="section-label">Watch for</h2>
				{#if data.mistakes.length === 0}
					<p class="empty">
						Your next session briefing will appear here once attempts have
						enough history.
					</p>
				{:else}
					<div class="rows">
						{#each data.mistakes as mistake (mistake.rank)}
							<article class="flex items-start justify-between gap-3 py-2.5">
								<div class="min-w-0">
									<h3 class="font-medium">{mistake.name}</h3>
									<p class="text-sm text-muted">
										{mistake.guardrail ?? 'No guardrail recorded yet.'}
									</p>
									<p class="tag mt-0.5">
										last seen {mistake.lastOccurrence.slice(0, 10)}
									</p>
								</div>
								<span class="shrink-0 font-mono text-sm text-live"
									>×{mistake.occurrenceCount}</span
								>
							</article>
						{/each}
					</div>
				{/if}
			</section>

			<section>
				<h2 class="section-label">Due redos</h2>
				{#if data.redos.length === 0}
					<p class="empty">Problems with due redo dates will be queued here.</p>
				{:else}
					<ul class="rows">
						{#each data.redos as redo (redo.rank)}
							<li class="flex items-baseline justify-between gap-3 py-2.5">
								<a
									class="link min-w-0 font-medium"
									href={redo.url}
									target="_blank"
									rel="noreferrer noopener">{redo.title}</a
								>
								<span class="shrink-0 font-mono text-sm text-muted"
									>due {redo.dueDate}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	</div>
</main>
