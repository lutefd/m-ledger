<script lang="ts">
	let { data } = $props();
</script>

<main class="mx-auto max-w-4xl px-6 py-8">
	<h1 class="text-3xl font-semibold">{data.mistake.name}</h1>
	{#if data.mistake.guardrail}<p class="mt-3 text-muted">
			{data.mistake.guardrail}
		</p>{/if}
	<div class="mt-6 space-y-3">
		{#each data.history as item (item.attemptId)}
			<article class="rounded-lg border border-line bg-white/60 p-5">
				<a class="font-semibold underline" href={`/problems/${item.problemId}`}
					>{item.problemTitle}</a
				>
				<p class="mt-1 text-sm text-muted">
					{item.completedAt} · confidence {item.confidence ?? '-'}
				</p>
			</article>
		{/each}
	</div>
</main>
