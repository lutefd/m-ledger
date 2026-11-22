<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import type { RichTextDocument } from '$lib/server/validation/rich-text';
	import { formatDuration } from '$lib/utils/time';
	import { enhanceWithToast } from '$lib/utils/forms';

	let { data } = $props();

	function parseDocument(value: string | null): RichTextDocument | null {
		return value ? JSON.parse(value) : null;
	}

	function confirmDelete(event: SubmitEvent) {
		if (!window.confirm('Delete this session and all related records?')) {
			event.preventDefault();
		}
	}
</script>

<svelte:head>
	<title>History | AlgoDrill</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-6 py-8">
	<h1 class="text-3xl font-semibold">History</h1>
	<section class="mt-6">
		<h2 class="text-2xl font-semibold">Activity</h2>
		<p class="mt-2 text-muted">
			Timed attempts and accepted NeetCode solves stay separate, but matching
			activity is shown together.
		</p>
		{#if data.history.length === 0}
			<p class="mt-4 rounded-lg border border-line bg-white/55 p-5 text-muted">
				No activity yet.
			</p>
		{:else}
			<div
				class="mt-4 divide-y divide-line rounded-lg border border-line bg-white/60"
			>
				{#each data.history as item (item.id)}
					<article class="p-5">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<a
								class="font-semibold underline"
								href={`/problems/${item.problemId}`}
							>
								{item.problemTitle}
							</a>
							<span class="text-sm text-muted"
								>{new Date(item.activityAt).toLocaleString()}</span
							>
						</div>

						{#if item.externalSolve}
							<div class="mt-4 rounded-md border border-line bg-white/70 p-4">
								<p class="font-semibold">Accepted NeetCode solve</p>
								<p class="mt-1 text-sm text-muted">
									{item.externalSolve.language} · {item.externalSolve
										.submissionPath}
								</p>
								<a
									class="mt-3 inline-block rounded border border-line px-3 py-2 text-sm"
									href={item.externalSolve.sourceCodeUrl}
									target="_blank"
									rel="noreferrer noopener"
								>
									View source
								</a>
							</div>
						{/if}

						{#if item.timedAttempt}
							<div class="mt-3 rounded-md border border-line bg-white/70 p-4">
								<p class="font-semibold">Timed attempt</p>
								<p class="mt-1 text-sm text-muted">
									{formatDuration(item.timedAttempt.elapsedMs)} ·
									{item.timedAttempt.outcome ?? 'Incomplete'} · confidence
									{item.timedAttempt.confidence ?? '-'}
								</p>
								{#if item.timedAttempt.notesDocument}
									<div class="mt-3">
										<p class="mb-2 text-sm font-medium">Recap notes</p>
										<RichTextEditor
											document={parseDocument(item.timedAttempt.notesDocument)}
											editable={false}
											variant="recap"
										/>
									</div>
								{/if}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
		{#if !data.history.some((item) => item.externalSolve)}
			<p class="mt-4 text-sm text-muted">
				No external solves yet. Sync NeetCode history from the Problems page.
			</p>
		{/if}
	</section>

	<section class="mt-10">
		<h2 class="text-2xl font-semibold">Timed sessions</h2>
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
							use:enhance={enhanceWithToast}
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
	</section>
</main>
