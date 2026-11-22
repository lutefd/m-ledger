<script lang="ts">
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import type { RichTextDocument } from '$lib/server/validation/rich-text';
	import { formatDuration } from '$lib/utils/time';
	import { problemProviderLabel } from '$lib/utils/providers';
	let { data } = $props();

	function parseDocument(value: string | null): RichTextDocument | null {
		return value ? JSON.parse(value) : null;
	}
</script>

<svelte:head>
	<title>{data.problem.title} | Problems | AlgoDrill</title>
</svelte:head>

<main class="page">
	<header class="page-head">
		<div class="min-w-0">
			<div class="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
				<span class="tag">{problemProviderLabel(data.problem.provider)}</span>
				<span class="tag" aria-hidden="true">/</span>
				<span class="tag break-all">{data.problem.slug}</span>
				{#if data.problem.difficulty}
					<span class="tag" aria-hidden="true">·</span>
					<span class="tag capitalize">{data.problem.difficulty}</span>
				{/if}
			</div>
			<h1 class="page-title">{data.problem.title}</h1>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<div
				class="flex items-center gap-2 font-mono text-xs text-muted tabular-nums"
			>
				<span>{formatDuration(data.totalMs)}</span>
				<span class="text-faint" aria-hidden="true">·</span>
				<span>
					{data.history.length}
					{data.history.length === 1 ? 'attempt' : 'attempts'}
				</span>
			</div>
			{#if data.problem.url}
				<a
					class="btn btn-secondary"
					href={data.problem.url}
					target="_blank"
					rel="noreferrer noopener"
				>
					Open problem
				</a>
			{/if}
		</div>
	</header>

	<section>
		<div class="section-label">
			<h2>Timed attempts</h2>
			<span class="tag">{data.history.length}</span>
		</div>
		{#if data.history.length === 0}
			<p class="empty">No timed attempts for this problem yet.</p>
		{:else}
			<div class="panel rows">
				{#each data.history as attempt (attempt.attemptId)}
					<article class="p-4">
						<div
							class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
						>
							<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
								<p class="text-sm font-medium">
									{attempt.outcome ?? 'Incomplete'}
								</p>
								<span class="font-mono text-xs text-muted">
									confidence {attempt.confidence ?? '-'}
								</span>
							</div>
							<div
								class="flex flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted tabular-nums"
							>
								<span
									>{attempt.completedAt ??
										attempt.redoDate ??
										'Not completed'}</span
								>
								<span class="text-faint" aria-hidden="true">·</span>
								<span
									>{formatDuration(
										Math.round(Number(attempt.elapsedMs ?? 0))
									)}</span
								>
							</div>
						</div>
						{#if attempt.notesDocument}
							<div class="mt-3">
								<RichTextEditor
									document={parseDocument(attempt.notesDocument)}
									editable={false}
									variant="recap"
								/>
							</div>
						{/if}
						{#if attempt.relatedExternalSolves.length > 0}
							<div class="mt-3 border-t border-line-soft pt-3 text-xs">
								<p class="font-medium text-muted">Related external solve</p>
								<div class="mt-1.5 space-y-1">
									{#each attempt.relatedExternalSolves as solve (solve.id)}
										<p class="flex flex-wrap items-baseline gap-x-2 text-muted">
											<span class="font-medium text-fg">{solve.language}</span>
											<span class="font-mono text-faint">
												{new Date(solve.submittedAt).toLocaleString()}
											</span>
											<a
												class="link text-fg"
												href={solve.sourceCodeUrl}
												target="_blank"
												rel="noreferrer noopener">View source</a
											>
										</p>
									{/each}
								</div>
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section>
		<div class="section-label">
			<h2>External solves</h2>
			<span class="tag">{data.externalSolves.length}</span>
		</div>
		{#if data.externalSolves.length === 0}
			<p class="empty">No external solves for this problem yet.</p>
		{:else}
			<div class="panel rows">
				{#each data.externalSolves as solve (solve.id)}
					<article
						class="row flex-wrap items-start justify-between gap-3 py-3 sm:flex-nowrap sm:items-center"
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
								<p class="text-sm font-medium">{solve.language}</p>
								<span class="font-mono text-xs text-muted">
									{new Date(solve.submittedAt).toLocaleString()}
								</span>
							</div>
							<p class="tag mt-0.5 break-all">{solve.submissionPath}</p>
							{#if solve.linkedAttempt}
								<p class="mt-1 font-mono text-xs text-muted tabular-nums">
									Linked timed attempt:
									{solve.linkedAttempt.completedAt ??
										solve.linkedAttempt.createdAt} ·
									{formatDuration(
										Math.round(Number(solve.linkedAttempt.elapsedMs ?? 0))
									)}
								</p>
							{/if}
						</div>
						<a
							class="btn btn-secondary shrink-0"
							href={solve.sourceCodeUrl}
							target="_blank"
							rel="noreferrer noopener"
						>
							View source
						</a>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>
