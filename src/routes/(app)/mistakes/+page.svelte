<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus } from '@lucide/svelte';

	let { data, form } = $props();
</script>

<main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[380px_1fr]">
	<section>
		<h1 class="text-3xl font-semibold">Mistakes</h1>
		<p class="mt-3 text-muted">
			Capture reusable mistakes and the guardrails that prevent them.
		</p>
		<form
			method="POST"
			use:enhance
			class="mt-6 space-y-4 rounded-lg border border-line bg-white/60 p-5"
		>
			{#if form?.message}
				<p class="text-sm text-muted">{form.message}</p>
			{/if}
			<input
				name="name"
				class="w-full rounded border border-line bg-white px-3 py-2"
				placeholder="Boundary condition"
				required
			/>
			<textarea
				name="description"
				class="min-h-24 w-full rounded border border-line bg-white px-3 py-2"
				placeholder="What tends to happen?"></textarea>
			<textarea
				name="guardrail"
				class="min-h-24 w-full rounded border border-line bg-white px-3 py-2"
				placeholder="What check catches it?"></textarea>
			<button
				class="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 font-semibold text-white"
				type="submit"
			>
				<Plus size={18} aria-hidden="true" />
				Add mistake
			</button>
		</form>
	</section>
	<section class="space-y-3">
		{#if data.mistakes.length === 0}
			<div class="rounded-lg border border-line bg-white/55 p-6 text-muted">
				No mistakes yet.
			</div>
		{:else}
			{#each data.mistakes as mistake (mistake.id)}
				<article class="rounded-lg border border-line bg-white/60 p-5">
					<h2 class="text-xl font-semibold">{mistake.name}</h2>
					{#if mistake.guardrail}
						<p class="mt-3 text-muted">{mistake.guardrail}</p>
					{/if}
				</article>
			{/each}
		{/if}
	</section>
</main>
