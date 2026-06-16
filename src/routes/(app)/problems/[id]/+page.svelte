<script lang="ts">
	import { formatDuration } from '$lib/utils/time';
	let { data } = $props();
</script>

<main class="mx-auto max-w-4xl px-6 py-8">
	<h1 class="text-3xl font-semibold">{data.problem.title}</h1>
	<p class="mt-2 text-muted">
		{data.problem.slug} · {formatDuration(data.totalMs)}
	</p>
	<div class="mt-6 space-y-3">
		{#each data.history as attempt (attempt.attemptId)}
			<article class="rounded-lg border border-line bg-white/60 p-5">
				<p class="font-semibold">
					{attempt.outcome ?? 'Incomplete'}
					<span class="text-sm text-muted"
						>confidence {attempt.confidence ?? '-'}</span
					>
				</p>
				<p class="mt-1 text-sm text-muted">
					{attempt.completedAt ?? attempt.redoDate ?? 'Not completed'}
				</p>
				{#if attempt.notes}<p class="mt-3">{attempt.notes}</p>{/if}
			</article>
		{/each}
	</div>
</main>
