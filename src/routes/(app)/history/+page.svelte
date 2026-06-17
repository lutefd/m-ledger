<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import { formatDuration } from '$lib/utils/time';

	let { data } = $props();

	function confirmDelete(event: SubmitEvent) {
		if (!window.confirm('Delete this session and all related records?')) {
			event.preventDefault();
		}
	}
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
				<article class="flex items-center justify-between gap-3 p-4">
					<a class="min-w-0 flex-1" href={`/sessions/${session.id}`}>
						<span>{session.startedAt.slice(0, 10)}</span>
						<span class="ml-3 text-sm text-muted">{session.status}</span>
						<span class="ml-3 text-sm text-muted"
							>{formatDuration(session.elapsedMs)}</span
						>
					</a>
					<form
						method="POST"
						action="?/delete"
						use:enhance
						onsubmit={confirmDelete}
					>
						<input type="hidden" name="sessionId" value={session.id} />
						<button
							class="rounded border border-red-200 p-2 text-red-700"
							type="submit"
							aria-label={`Delete session from ${session.startedAt.slice(0, 10)}`}
						>
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</form>
				</article>
			{/each}
		</div>
	{/if}
</main>
