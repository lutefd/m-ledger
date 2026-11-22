<script lang="ts">
	import { enhance } from '$app/forms';
	import ProblemFilters from '$lib/components/ProblemFilters.svelte';
	import { enhanceWithToast } from '$lib/utils/forms';
	import {
		emptyProblemFilter,
		matchesProblemFilter
	} from '$lib/utils/problem-filter';
	import { problemProviderLabel } from '$lib/utils/providers';

	let { data } = $props();
	let filter = $state(emptyProblemFilter());
	let selected = $state<string[]>([]);
	const visibleCount = $derived(
		data.problems.filter((problem) => matchesProblemFilter(problem, filter))
			.length
	);
</script>

<svelte:head>
	<title>New session | AlgoDrill</title>
</svelte:head>

<main class="page max-w-3xl">
	<header class="page-head">
		<div>
			<p class="page-sub">Choose problems for today’s queue.</p>
			<h1 class="page-title">New session</h1>
		</div>
	</header>
	<form method="POST" use:enhance={enhanceWithToast} class="space-y-5">
		{#if data.problems.length === 0}
			<p class="empty">Add a problem before starting a session.</p>
		{:else}
			<label class="block max-w-md space-y-1.5">
				<span class="field-label"
					>Name <span class="text-faint">(optional)</span></span
				>
				<input
					name="name"
					class="input"
					maxlength="80"
					placeholder="Sliding window drills"
					autocomplete="off"
				/>
			</label>
			<ProblemFilters problems={data.problems} bind:filter />
			{#if visibleCount === 0}
				<p class="empty">No problems match these filters.</p>
			{/if}
			<div class={['panel rows', visibleCount === 0 && 'hidden']}>
				{#each data.problems as problem (problem.id)}
					<label
						class="row cursor-pointer hover:bg-hover"
						hidden={!matchesProblemFilter(problem, filter)}
					>
						<input
							type="checkbox"
							name="problemIds"
							value={problem.id}
							bind:group={selected}
							class="size-4 accent-[var(--live)]"
						/>
						<span class="min-w-0 flex-1">
							<span class="font-medium">{problem.title}</span>
							<span class="tag ml-2">{problem.slug}</span>
						</span>
						{#if problem.difficulty}
							<span class="shrink-0 text-xs text-muted capitalize"
								>{problem.difficulty}</span
							>
						{/if}
						<span class="tag shrink-0">
							{problemProviderLabel(problem.provider)}
						</span>
					</label>
				{/each}
			</div>
			<div class="flex items-center gap-3">
				<button class="btn btn-primary btn-lg" type="submit"
					>Create briefing</button
				>
				<span class="text-sm text-muted">
					{selected.length} selected
				</span>
			</div>
		{/if}
	</form>
</main>
