<script lang="ts">
	import { enhance } from '$app/forms';
	import { enhanceWithToast } from '$lib/utils/forms';
	import { problemProviderLabel } from '$lib/utils/providers';

	let { data } = $props();
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
			<div class="panel rows">
				{#each data.problems as problem (problem.id)}
					<label class="row cursor-pointer hover:bg-hover">
						<input
							type="checkbox"
							name="problemIds"
							value={problem.id}
							class="size-4 accent-[var(--live)]"
						/>
						<span class="min-w-0 flex-1">
							<span class="font-medium">{problem.title}</span>
							<span class="tag ml-2">{problem.slug}</span>
						</span>
						<span class="tag shrink-0">
							{problemProviderLabel(problem.provider)}
						</span>
					</label>
				{/each}
			</div>
			<button class="btn btn-primary btn-lg" type="submit"
				>Create briefing</button
			>
		{/if}
	</form>
</main>
