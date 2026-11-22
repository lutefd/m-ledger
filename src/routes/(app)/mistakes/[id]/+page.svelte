<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>{data.mistake.name} | Mistakes | AlgoDrill</title>
</svelte:head>

<main class="page">
	<header class="page-head">
		<div class="min-w-0">
			<p class="mb-1">
				<a class="tag link" href="/mistakes">Mistakes</a>
			</p>
			<h1 class="page-title">{data.mistake.name}</h1>
			{#if data.mistake.guardrail}
				<p class="page-sub mt-1">{data.mistake.guardrail}</p>
			{/if}
			{#if data.mistake.description}
				<p class="mt-1 text-xs text-muted">{data.mistake.description}</p>
			{/if}
		</div>
		{#if data.history.length > 0}
			<span class="font-mono text-xs text-live tabular-nums">
				×{data.history.length}
			</span>
		{/if}
	</header>

	<section>
		<div class="section-label">
			<h2>Occurrences</h2>
			<span class="tag">{data.history.length}</span>
		</div>
		{#if data.history.length === 0}
			<p class="empty">No recorded occurrences yet.</p>
		{:else}
			<div class="panel rows">
				{#each data.history as item (item.attemptId)}
					<article class="row flex-wrap justify-between gap-y-1">
						<a
							class="link text-sm font-medium"
							href={`/problems/${item.problemId}`}
						>
							{item.problemTitle}
						</a>
						<div
							class="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted tabular-nums"
						>
							{#if item.completedAt}
								<span>{item.completedAt}</span>
								<span class="text-faint" aria-hidden="true">·</span>
							{/if}
							<span>confidence {item.confidence ?? '-'}</span>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>
