<script lang="ts">
	let { data } = $props();
</script>

<main class="mx-auto max-w-6xl px-6 py-8">
	<h1 class="text-3xl font-semibold">History</h1>
	{#if data.sessions.length === 0}
		<p class="mt-3 text-muted">No sessions yet.</p>
	{:else}
		<div
			class="mt-6 divide-y divide-line rounded-lg border border-line bg-white/60"
		>
			{#each data.sessions as session (session.id)}
				<a
					class="flex items-center justify-between p-4"
					href={`/sessions/${session.id}`}
				>
					<span>{session.startedAt.slice(0, 10)}</span>
					<span class="text-sm text-muted">{session.status}</span>
				</a>
			{/each}
		</div>
	{/if}
</main>
