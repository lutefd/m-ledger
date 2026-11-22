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

<main class="page">
	<header class="page-head">
		<div class="min-w-0">
			<h1 class="page-title">History</h1>
			<p class="page-sub mt-1">
				Timed attempts and accepted NeetCode solves stay separate, but matching
				activity is shown together.
			</p>
		</div>
	</header>

	<section>
		<div class="section-label">
			<h2>Activity</h2>
			<span class="tag">{data.history.length}</span>
		</div>
		{#if data.history.length === 0}
			<p class="empty">No activity yet.</p>
		{:else}
			<div class="panel rows">
				{#each data.history as item (item.id)}
					<article class="p-4">
						<div
							class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
						>
							<a
								class="link text-sm font-medium"
								href={`/problems/${item.problemId}`}
							>
								{item.problemTitle}
							</a>
							<span class="font-mono text-xs text-faint tabular-nums">
								{new Date(item.activityAt).toLocaleString()}
							</span>
						</div>

						{#if item.externalSolve}
							<div
								class="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-line-soft pt-3 sm:flex-nowrap sm:items-center"
							>
								<div class="min-w-0 flex-1">
									<p class="text-xs font-medium text-muted">
										Accepted NeetCode solve
									</p>
									<p class="mt-0.5 text-sm">{item.externalSolve.language}</p>
									<p class="tag mt-0.5 break-all">
										{item.externalSolve.submissionPath}
									</p>
								</div>
								<a
									class="btn btn-secondary shrink-0"
									href={item.externalSolve.sourceCodeUrl}
									target="_blank"
									rel="noreferrer noopener"
								>
									View source
								</a>
							</div>
						{/if}

						{#if item.timedAttempt}
							<div class="mt-3 border-t border-line-soft pt-3">
								<div
									class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"
								>
									<p class="text-xs font-medium text-muted">Timed attempt</p>
									<p
										class="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted tabular-nums"
									>
										<span>{formatDuration(item.timedAttempt.elapsedMs)}</span>
										<span class="text-faint" aria-hidden="true">·</span>
										<span class="font-sans text-fg">
											{item.timedAttempt.outcome ?? 'Incomplete'}
										</span>
										<span class="text-faint" aria-hidden="true">·</span>
										<span>confidence {item.timedAttempt.confidence ?? '-'}</span
										>
									</p>
								</div>
								{#if item.timedAttempt.notesDocument}
									<div class="mt-3">
										<p class="mb-1.5 text-xs font-medium text-muted">
											Recap notes
										</p>
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
			<p class="mt-3 text-xs text-muted">
				No external solves yet. Sync NeetCode history from the Problems page.
			</p>
		{/if}
	</section>

	<section>
		<div class="section-label">
			<h2>Timed sessions</h2>
			<span class="tag">{data.sessions.length}</span>
		</div>
		{#if data.sessions.length === 0}
			<p class="empty">No sessions yet.</p>
		{:else}
			<div class="rows">
				{#each data.sessions as session (session.id)}
					<article class="flex items-center justify-between gap-3 py-2.5">
						<a
							class="group flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm"
							href={`/sessions/${session.id}`}
						>
							<span
								class="font-mono text-xs text-fg decoration-line underline-offset-4 group-hover:underline group-hover:decoration-fg"
							>
								{session.startedAt.slice(0, 10)}
							</span>
							{#if session.name}
								<span class="font-medium">{session.name}</span>
							{/if}
							<span class="text-xs text-muted">{session.status}</span>
							<span class="font-mono text-xs text-faint tabular-nums">
								{formatDuration(session.elapsedMs)}
							</span>
						</a>
						<form
							method="POST"
							action="?/delete"
							use:enhance={enhanceWithToast}
							onsubmit={confirmDelete}
						>
							<input type="hidden" name="sessionId" value={session.id} />
							<button
								class="btn btn-ghost btn-icon hover:bg-danger-soft hover:text-danger"
								type="submit"
								aria-label={`Delete session from ${session.startedAt.slice(0, 10)}`}
							>
								<Trash2 size={15} aria-hidden="true" />
							</button>
						</form>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>
