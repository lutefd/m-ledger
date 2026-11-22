<script lang="ts">
	import { Search } from '@lucide/svelte';
	import type { ProblemDifficulty } from '$lib/server/services/problems';
	import { countBy, type ProblemFilter } from '$lib/utils/problem-filter';
	import {
		problemProviderLabels,
		type ProblemProvider
	} from '$lib/utils/providers';

	let {
		problems,
		filter = $bindable()
	}: {
		problems: {
			provider: ProblemProvider;
			difficulty: ProblemDifficulty | null;
		}[];
		filter: ProblemFilter;
	} = $props();

	const providerOrder = Object.keys(problemProviderLabels) as ProblemProvider[];
	const difficultyOrder = ['easy', 'medium', 'hard'] as const;

	const providers = $derived(
		countBy(
			problems.map((problem) => problem.provider),
			providerOrder
		)
	);
	const difficulties = $derived(
		countBy(
			problems.map((problem) => problem.difficulty),
			difficultyOrder
		)
	);
</script>

{#snippet chip(
	selected: boolean,
	label: string,
	count: number,
	onclick: () => void
)}
	<button
		type="button"
		class={[
			'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
			selected
				? 'border-fg bg-fg text-bg'
				: 'border-line text-muted hover:border-faint hover:text-fg'
		]}
		aria-pressed={selected}
		{onclick}>{label} {count}</button
	>
{/snippet}

<div class="space-y-2">
	<label class="relative block">
		<Search
			size={14}
			class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
			aria-hidden="true"
		/>
		<input
			class="input pl-8"
			type="search"
			placeholder="Search by title or slug"
			aria-label="Search problems"
			bind:value={filter.query}
		/>
	</label>
	{#if providers.length > 1 || difficulties.length > 0}
		<div
			class="flex flex-wrap items-center gap-1.5"
			role="group"
			aria-label="Filter by source and difficulty"
		>
			{#if providers.length > 1}
				{@render chip(
					filter.provider === 'all',
					'All sources',
					problems.length,
					() => {
						filter.provider = 'all';
					}
				)}
				{#each providers as entry (entry.value)}
					{@render chip(
						filter.provider === entry.value,
						problemProviderLabels[entry.value],
						entry.count,
						() => {
							filter.provider =
								filter.provider === entry.value ? 'all' : entry.value;
						}
					)}
				{/each}
			{/if}
			{#if providers.length > 1 && difficulties.length > 0}
				<span class="mx-1 h-4 w-px bg-line" aria-hidden="true"></span>
			{/if}
			{#each difficulties as entry (entry.value)}
				{@render chip(
					filter.difficulty === entry.value,
					entry.value[0].toUpperCase() + entry.value.slice(1),
					entry.count,
					() => {
						filter.difficulty =
							filter.difficulty === entry.value ? 'all' : entry.value;
					}
				)}
			{/each}
		</div>
	{/if}
</div>
