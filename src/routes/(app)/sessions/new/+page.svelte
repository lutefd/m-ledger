<script lang="ts">
	import { enhance } from '$app/forms';
	import { enhanceWithToast } from '$lib/utils/forms';
	import { problemProviderLabel } from '$lib/utils/providers';

	let { data } = $props();
</script>

<svelte:head>
	<title>New session | AlgoDrill</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<h1 class="text-3xl font-semibold">New session</h1>
	<p class="mt-3 text-muted">Choose problems for today’s queue.</p>
	<form method="POST" use:enhance={enhanceWithToast} class="mt-6 space-y-4">
		{#if data.problems.length === 0}
			<div class="rounded-lg border border-line bg-white/60 p-5 text-muted">
				Add a problem before starting a session.
			</div>
		{:else}
			<div class="space-y-2">
				{#each data.problems as problem (problem.id)}
					<label
						class="flex items-center gap-3 rounded-lg border border-line bg-white/60 p-4"
					>
						<input type="checkbox" name="problemIds" value={problem.id} />
						<span>
							<span class="flex items-center gap-2">
								<span class="font-semibold">{problem.title}</span>
								<span
									class="rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent"
								>
									{problemProviderLabel(problem.provider)}
								</span>
							</span>
							<span class="text-sm text-muted">{problem.slug}</span>
						</span>
					</label>
				{/each}
			</div>
			<button
				class="rounded bg-accent px-4 py-2 font-semibold text-white"
				type="submit">Create briefing</button
			>
		{/if}
	</form>
</main>
