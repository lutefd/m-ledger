<script lang="ts">
	import { enhance } from '$app/forms';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import type { RichTextDocument } from '$lib/server/validation/rich-text';
	import { formatDuration } from '$lib/utils/time';

	let { data, form } = $props();
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

	function setRecapDocument(
		attemptId: string,
		document: RichTextDocument | null
	) {
		recapDocuments = { ...recapDocuments, [attemptId]: document };
	}
</script>

<main class="mx-auto max-w-5xl px-6 py-8">
	<h1 class="text-3xl font-semibold">Session recap</h1>
	<p class="mt-3 text-muted">
		Record the outcome, confidence, mistakes, patterns, notes, and redo date for
		every activated problem.
	</p>
	<section class="mt-6 rounded-lg border border-line bg-white/60 p-4">
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="rounded border border-line px-3 py-2 text-sm font-semibold"
				onclick={() => {
					showMistakeForm = !showMistakeForm;
					showPatternForm = false;
				}}>New mistake</button
			>
			<button
				type="button"
				class="rounded border border-line px-3 py-2 text-sm font-semibold"
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
				use:enhance
				class="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]"
			>
				<input
					name="name"
					class="rounded border border-line bg-white px-3 py-2 text-sm"
					placeholder="Name"
					required
				/>
				<input
					name="guardrail"
					class="rounded border border-line bg-white px-3 py-2 text-sm"
					placeholder="Guardrail"
				/>
				<button
					class="rounded bg-ink px-3 py-2 text-sm font-semibold text-white"
					type="submit">Create</button
				>
			</form>
		{/if}
		{#if showPatternForm}
			<form
				method="POST"
				action="?/createPattern"
				use:enhance
				class="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]"
			>
				<input
					name="name"
					class="rounded border border-line bg-white px-3 py-2 text-sm"
					placeholder="Name"
					required
				/>
				<input
					name="recognitionTrigger"
					class="rounded border border-line bg-white px-3 py-2 text-sm"
					placeholder="Recognition trigger"
				/>
				<button
					class="rounded bg-ink px-3 py-2 text-sm font-semibold text-white"
					type="submit">Create</button
				>
			</form>
		{/if}
	</section>
	<form method="POST" use:enhance class="mt-6 space-y-5">
		{#if form?.message}
			<p
				class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
			>
				{form.message}
			</p>
		{/if}
		{#if attempts.length === 0}
			<div class="rounded-lg border border-line bg-white/60 p-5 text-muted">
				No activated attempts yet.
			</div>
		{:else}
			{#each attempts as attempt (attempt.attemptId)}
				{@const attemptId = attempt.attemptId}
				<details class="rounded-lg border border-line bg-white/60 p-5" open>
					<summary class="cursor-pointer text-xl font-semibold">
						{attempt.title}
						<span class="ml-2 text-sm font-normal text-muted">
							{formatDuration(attempt.elapsedMs)}
						</span>
					</summary>
					{#if attemptId}
						<input type="hidden" name="attemptId" value={attempt.attemptId} />
						<input
							type="hidden"
							name={`notesDocument:${attemptId}`}
							value={recapDocuments[attemptId]
								? JSON.stringify(recapDocuments[attemptId])
								: ''}
						/>
						<div class="mt-4 grid gap-4 md:grid-cols-2">
							<label class="block space-y-2">
								<span class="text-sm font-medium">Outcome</span>
								<select
									name={`outcome:${attempt.attemptId}`}
									class="w-full rounded border border-line bg-white px-3 py-2"
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
							<label class="block space-y-2">
								<span class="text-sm font-medium">Confidence</span>
								<select
									name={`confidence:${attempt.attemptId}`}
									class="w-full rounded border border-line bg-white px-3 py-2"
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
						</div>
						<label class="mt-4 block space-y-2">
							<span class="text-sm font-medium">Redo date</span>
							<input
								id={`redoDate:${attempt.attemptId}`}
								name={`redoDate:${attempt.attemptId}`}
								type="date"
								class="w-full rounded border border-line bg-white px-3 py-2"
							/>
						</label>
						<div class="mt-4 space-y-2">
							<span class="text-sm font-medium">Notes</span>
							<RichTextEditor
								document={recapDocuments[attemptId]}
								variant="recap"
								onChange={(document) => setRecapDocument(attemptId, document)}
							/>
						</div>
					{/if}
					<div class="mt-4 grid gap-4 md:grid-cols-2">
						<fieldset class="space-y-2">
							<legend class="text-sm font-medium">Mistakes</legend>
							{#each data.mistakes as mistake (mistake.id)}
								<label class="flex gap-2 text-sm"
									><input
										type="checkbox"
										name={`mistakes:${attempt.attemptId}`}
										value={mistake.id}
									/>{mistake.name}</label
								>
							{/each}
						</fieldset>
						<fieldset class="space-y-2">
							<legend class="text-sm font-medium">Patterns</legend>
							{#each data.patterns as pattern (pattern.id)}
								<label class="flex gap-2 text-sm"
									><input
										type="checkbox"
										name={`patterns:${attempt.attemptId}`}
										value={pattern.id}
									/>{pattern.name}</label
								>
							{/each}
						</fieldset>
					</div>
				</details>
			{/each}
			<button
				class="rounded bg-accent px-4 py-2 font-semibold text-white"
				type="submit">Save recap</button
			>
		{/if}
	</form>
</main>
