<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<main class="mx-auto max-w-3xl px-6 py-8">
	<h1 class="text-3xl font-semibold">New session</h1>
	<p class="mt-3 text-muted">Choose problems for today’s queue.</p>
	<form method="POST" use:enhance class="mt-6 space-y-4">
		{#if form?.message}
			<p
				class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
			>
				{form.message}
			</p>
		{/if}
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
							<span class="block font-semibold">{problem.title}</span>
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
