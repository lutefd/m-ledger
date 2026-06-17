<script lang="ts">
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import type { RichTextDocument } from '$lib/server/validation/rich-text';
	import { formatDuration } from '$lib/utils/time';
	let { data } = $props();

	function parseDocument(value: string | null): RichTextDocument | null {
		return value ? JSON.parse(value) : null;
	}
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
			</article>
		{/each}
	</div>
</main>
