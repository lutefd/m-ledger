<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import { enhance } from '$app/forms';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import type { RichTextDocument } from '$lib/server/validation/rich-text';
	import { formatDuration } from '$lib/utils/time';
	import { enhanceWithToast } from '$lib/utils/forms';

	let { data } = $props();
	const attempts = $derived(data.queue.filter((item) => item.attemptId));
	let recapDocuments = $state<Record<string, RichTextDocument | null>>(
		Object.fromEntries(
			attempts.map((attempt) => [
				attempt.attemptId,
				attempt.notesDocument ? JSON.parse(attempt.notesDocument) : null
			])
		)
	);
	let showMistakeForm = $state(false);
	let showPatternForm = $state(false);

	function suggestRedoDate(event: Event, attemptId: string) {
		const confidence = (event.currentTarget as HTMLSelectElement).value;
		const suggestion = data.redoSuggestions[confidence];
		const input = document.getElementById(
			`redoDate:${attemptId}`
		) as HTMLInputElement | null;
		if (!suggestion || !input || input.value) return;

		input.value = suggestion;
	}

	function setRecapDocument(attemptId: string, value: RichTextDocument | null) {
		recapDocuments[attemptId] = value;
		const input = document.getElementById(
			`notesDocument:${attemptId}`
		) as HTMLInputElement | null;
		if (input) input.value = value ? JSON.stringify(value) : '';
	}
</script>

<svelte:head>
	<title>Session recap | AlgoDrill</title>
</svelte:head>

<main class="page max-w-4xl">
	<header class="page-head">
		<div>
			{#if data.session.name}
				<p class="text-sm font-medium">{data.session.name}</p>
			{/if}
			<p class="page-sub">
				Record the outcome, confidence, mistakes, patterns, notes, and redo date
				for every activated problem.
			</p>
			<h1 class="page-title">Session recap</h1>
		</div>
	</header>
	<section class="space-y-3">
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="btn btn-ghost"
				onclick={() => {
					showMistakeForm = !showMistakeForm;
					showPatternForm = false;
				}}>New mistake</button
			>
			<button
				type="button"
				class="btn btn-ghost"
				onclick={() => {
					showPatternForm = !showPatternForm;
					showMistakeForm = false;
				}}>New pattern</button
			>
		</div>
		{#if showMistakeForm}
			<form
				method="POST"
				action="?/createMistake"
				use:enhance={enhanceWithToast}
				class="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
			>
				<input name="name" class="input" placeholder="Name" required />
				<input name="guardrail" class="input" placeholder="Guardrail" />
				<button class="btn btn-secondary" type="submit">Create</button>
			</form>
		{/if}
		{#if showPatternForm}
			<form
				method="POST"
				action="?/createPattern"
				use:enhance={enhanceWithToast}
				class="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
			>
				<input name="name" class="input" placeholder="Name" required />
				<input
					name="recognitionTrigger"
					class="input"
					placeholder="Recognition trigger"
				/>
				<button class="btn btn-secondary" type="submit">Create</button>
			</form>
		{/if}
	</section>
	<form
		method="POST"
		action="?/save"
		use:enhance={enhanceWithToast}
		class="space-y-5"
	>
		{#if attempts.length === 0}
			<p class="empty">No activated attempts yet.</p>
		{:else}
			{#each attempts as attempt (attempt.attemptId)}
				{@const attemptId = attempt.attemptId}
				<details class="group panel space-y-5 p-4 sm:p-5" open>
					<summary
						class="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden"
					>
						<ChevronRight
							size={16}
							class="shrink-0 text-faint transition-transform group-open:rotate-90"
							aria-hidden="true"
						/>
						<h2 class="flex-1 text-lg font-semibold tracking-tight">
							{attempt.title}
						</h2>
						<span class="shrink-0 font-mono text-sm text-muted">
							{formatDuration(attempt.elapsedMs)}
						</span>
					</summary>
					{#if attemptId}
						<input type="hidden" name="attemptId" value={attempt.attemptId} />
						<input
							type="hidden"
							id={`notesDocument:${attemptId}`}
							name={`notesDocument:${attemptId}`}
							value={recapDocuments[attemptId]
								? JSON.stringify(recapDocuments[attemptId])
								: ''}
						/>
						<div class="grid gap-4 md:grid-cols-3">
							<label class="block space-y-1.5">
								<span class="field-label">Outcome</span>
								<select
									name={`outcome:${attempt.attemptId}`}
									class="input"
									required
								>
									<option value="">Choose</option>
									<option value="solved_independently"
										>Solved independently</option
									>
									<option value="solved_with_help">Solved with help</option>
									<option value="partial">Partial</option>
									<option value="stuck">Stuck</option>
								</select>
							</label>
							<label class="block space-y-1.5">
								<span class="field-label">Confidence</span>
								<select
									name={`confidence:${attempt.attemptId}`}
									class="input"
									required
									onchange={(event) =>
										attempt.attemptId &&
										suggestRedoDate(event, attempt.attemptId)}
								>
									<option value="">Choose</option>
									{#each [1, 2, 3, 4, 5] as value (value)}
										<option {value}>{value}</option>
									{/each}
								</select>
							</label>
							<label class="block space-y-1.5">
								<span class="field-label">Redo date</span>
								<input
									id={`redoDate:${attempt.attemptId}`}
									name={`redoDate:${attempt.attemptId}`}
									type="date"
									class="input font-mono"
								/>
							</label>
						</div>
					{/if}
					<div class="grid gap-4 md:grid-cols-2">
						<fieldset class="space-y-2">
							<legend class="field-label mb-1">Mistakes</legend>
							{#each data.mistakes as mistake (mistake.id)}
								<label class="flex items-center gap-2 text-sm"
									><input
										type="checkbox"
										class="size-4 accent-[var(--live)]"
										name={`mistakes:${attempt.attemptId}`}
										value={mistake.id}
									/>{mistake.name}</label
								>
							{/each}
						</fieldset>
						<fieldset class="space-y-2">
							<legend class="field-label mb-1">Patterns</legend>
							{#each data.patterns as pattern (pattern.id)}
								<label class="flex items-center gap-2 text-sm"
									><input
										type="checkbox"
										class="size-4 accent-[var(--live)]"
										name={`patterns:${attempt.attemptId}`}
										value={pattern.id}
									/>{pattern.name}</label
								>
							{/each}
						</fieldset>
					</div>
					{#if attemptId}
						<div class="space-y-1.5">
							<span class="field-label">Notes</span>
							<RichTextEditor
								document={recapDocuments[attemptId]}
								variant="recap"
								onChange={(document) => setRecapDocument(attemptId, document)}
							/>
						</div>
					{/if}
				</details>
			{/each}
			<button class="btn btn-primary btn-lg" type="submit">Save recap</button>
		{/if}
	</form>
</main>
