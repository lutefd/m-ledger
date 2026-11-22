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

<main class="mx-auto max-w-4xl px-6 py-8">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="text-3xl font-semibold">{data.problem.title}</h1>
		<span
			class="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent"
		>
			{problemProviderLabel(data.problem.provider)}
		</span>
	</div>
	<p class="mt-2 text-muted">
		{data.problem.slug} · {formatDuration(data.totalMs)}
	</p>
	<section class="mt-6">
		<h2 class="text-xl font-semibold">Timed attempts</h2>
		{#if data.history.length === 0}
			<p class="mt-3 rounded-lg border border-line bg-white/55 p-5 text-muted">
				No timed attempts for this problem yet.
			</p>
		{:else}
			<div class="mt-3 space-y-3">
				{#each data.history as attempt (attempt.attemptId)}
					<article class="rounded-lg border border-line bg-white/60 p-5">
						<p class="font-semibold">
							{attempt.outcome ?? 'Incomplete'}
							<span class="text-sm text-muted"
								>confidence {attempt.confidence ?? '-'}</span
							>
						</p>
						<p class="mt-1 text-sm text-muted">
							{attempt.completedAt ?? attempt.redoDate ?? 'Not completed'} ·
							{formatDuration(Math.round(Number(attempt.elapsedMs ?? 0)))}
						</p>
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
							<div class="mt-3 border-t border-line pt-3 text-sm">
								<p class="font-semibold">Related external solve</p>
								{#each attempt.relatedExternalSolves as solve (solve.id)}
									<p class="mt-1 text-muted">
										{solve.language} · {new Date(
											solve.submittedAt
										).toLocaleString()}
										·
										<a
											class="underline"
											href={solve.sourceCodeUrl}
											target="_blank"
											rel="noreferrer noopener">View source</a
										>
									</p>
								{/each}
							</div>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>

	<section class="mt-10">
		<h2 class="text-xl font-semibold">External solves</h2>
		{#if data.externalSolves.length === 0}
			<p class="mt-3 rounded-lg border border-line bg-white/55 p-5 text-muted">
				No external solves for this problem yet.
			</p>
		{:else}
			<div class="mt-3 space-y-3">
				{#each data.externalSolves as solve (solve.id)}
					<article
						class="flex items-center justify-between gap-4 rounded-lg border border-line bg-white/60 p-5"
					>
						<div>
							<p class="font-semibold">{solve.language}</p>
							<p class="mt-1 text-sm text-muted">
								{new Date(solve.submittedAt).toLocaleString()} ·
								{solve.submissionPath}
							</p>
							{#if solve.linkedAttempt}
								<p class="mt-2 text-sm text-muted">
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
							class="shrink-0 rounded border border-line px-3 py-2 text-sm"
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
