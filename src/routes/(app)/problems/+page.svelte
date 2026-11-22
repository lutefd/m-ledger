<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, Plus } from '@lucide/svelte';
	import ProblemFilters from '$lib/components/ProblemFilters.svelte';
	import { enhanceWithToast } from '$lib/utils/forms';
	import {
		emptyProblemFilter,
		matchesProblemFilter
	} from '$lib/utils/problem-filter';
	import { problemProviderLabel } from '$lib/utils/providers';

	let { data } = $props();
	let filter = $state(emptyProblemFilter());
	const visible = $derived(
		data.problems.filter((problem) => matchesProblemFilter(problem, filter))
	);
	const missingDetails = $derived(
		data.problems.filter(
			(problem) => problem.provider === 'leetcode' && !problem.difficulty
		).length
	);
</script>

<svelte:head>
	<title>Problems | AlgoDrill</title>
</svelte:head>

<main class="page">
	<header class="page-head">
		<div class="min-w-0">
			<h1 class="page-title">Problems</h1>
			<p class="page-sub mt-1">
				Add problems from LeetCode, NeetCode, HackerRank, or another HTTPS
				practice site.
			</p>
		</div>
		<form method="POST" action="?/sync" use:enhance={enhanceWithToast}>
			<button class="btn btn-secondary" type="submit">
				Sync NeetCode history
			</button>
		</form>
	</header>

	<div class="grid items-start gap-8 lg:grid-cols-[296px_1fr]">
		<section>
			<div class="section-label">
				<h2>Add problem</h2>
			</div>
			<form
				method="POST"
				action="?/save"
				use:enhance={enhanceWithToast}
				class="panel space-y-3 p-4"
			>
				<label class="block space-y-1">
					<span class="field-label">Problem URL</span>
					<input
						name="url"
						type="url"
						class="input"
						placeholder="https://leetcode.com/problems/two-sum/"
						required
					/>
				</label>
				<p class="text-xs text-muted">
					Title, difficulty and topics come from LeetCode automatically.
				</p>
				<details class="group">
					<summary
						class="cursor-pointer list-none text-xs font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden"
					>
						<span class="group-open:hidden">Set details yourself</span>
						<span class="hidden group-open:inline">Hide details</span>
					</summary>
					<div class="mt-3 space-y-3">
						<label class="block space-y-1">
							<span class="field-label">Title override</span>
							<input name="title" class="input" />
						</label>
						<label class="block space-y-1">
							<span class="field-label">Difficulty</span>
							<select name="difficulty" class="input">
								<option value="">From LeetCode</option>
								<option value="easy">Easy</option>
								<option value="medium">Medium</option>
								<option value="hard">Hard</option>
							</select>
						</label>
						<label class="block space-y-1">
							<span class="field-label">Topics</span>
							<input
								name="topics"
								class="input"
								placeholder="arrays, two pointers"
							/>
						</label>
					</div>
				</details>
				<button class="btn btn-primary w-full" type="submit">
					<Plus size={15} aria-hidden="true" />
					Add problem
				</button>
			</form>
		</section>

		<section
			class="min-h-0 overflow-y-auto lg:max-h-[calc(100vh-11rem)]"
			aria-label="Problem list"
		>
			<div class="section-label">
				<h2>Library</h2>
				<span class="tag">
					{visible.length === data.problems.length
						? data.problems.length
						: `${visible.length} of ${data.problems.length}`}
				</span>
			</div>
			{#if missingDetails > 0}
				<form
					method="POST"
					action="?/fillDetails"
					use:enhance={enhanceWithToast}
					class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-live-soft px-3 py-2 text-sm"
				>
					<span>
						{missingDetails} LeetCode problem{missingDetails === 1 ? '' : 's'}
						{missingDetails === 1 ? 'has' : 'have'} no difficulty yet.
					</span>
					<button class="btn btn-secondary" type="submit"
						>Fill from LeetCode</button
					>
				</form>
			{/if}
			{#if data.problems.length === 0}
				<p class="empty">No problems yet.</p>
			{:else}
				<div class="mb-3">
					<ProblemFilters problems={data.problems} bind:filter />
				</div>
				{#if visible.length === 0}
					<p class="empty">No problems match these filters.</p>
				{/if}
				<div class={['panel rows', visible.length === 0 && 'hidden']}>
					{#each visible as problem (problem.id)}
						<article class="row">
							<div class="min-w-0 flex-1">
								<h3 class="text-sm font-medium">
									<a class="link" href={`/problems/${problem.id}`}>
										{problem.title}
									</a>
								</h3>
								<div
									class="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
								>
									<span class="tag"
										>{problemProviderLabel(problem.provider)}</span
									>
									<span class="tag" aria-hidden="true">/</span>
									<span class="tag break-all">{problem.slug}</span>
								</div>
							</div>
							<div class="ml-auto flex shrink-0 items-center gap-2">
								{#if problem.difficulty}
									<span class="text-xs capitalize text-muted">
										{problem.difficulty}
									</span>
								{/if}
								<a
									class="btn btn-ghost btn-icon"
									href={problem.url}
									target="_blank"
									rel="noreferrer noopener"
									aria-label={`Open ${problem.title}`}
									title="Open external"
								>
									<ExternalLink size={15} aria-hidden="true" />
								</a>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>
