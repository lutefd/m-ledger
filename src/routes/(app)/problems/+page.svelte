<script lang="ts">
	import { enhance } from '$app/forms';
	import { ExternalLink, Plus } from '@lucide/svelte';

	let { data, form } = $props();
</script>

<main class="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[380px_1fr]">
	<section>
		<h1 class="text-3xl font-semibold">Problems</h1>
		<p class="mt-3 text-muted">
			Add HTTPS LeetCode problem URLs and keep the canonical version here.
		</p>

		<form
			method="POST"
			use:enhance
			class="mt-6 space-y-4 rounded-lg border border-line bg-white/60 p-5"
		>
			{#if form?.message}
				<p
					class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
					role="alert"
				>
					{form.message}
				</p>
			{/if}
			<label class="block space-y-2">
				<span class="text-sm font-medium">LeetCode URL</span>
				<input
					name="url"
					type="url"
					class="w-full rounded border border-line bg-white px-3 py-2"
					required
				/>
			</label>
			<label class="block space-y-2">
				<span class="text-sm font-medium">Title override</span>
				<input
					name="title"
					class="w-full rounded border border-line bg-white px-3 py-2"
				/>
			</label>
			<label class="block space-y-2">
				<span class="text-sm font-medium">Difficulty</span>
				<select
					name="difficulty"
					class="w-full rounded border border-line bg-white px-3 py-2"
				>
					<option value="">Unset</option>
					<option value="easy">Easy</option>
					<option value="medium">Medium</option>
					<option value="hard">Hard</option>
				</select>
			</label>
			<label class="block space-y-2">
				<span class="text-sm font-medium">Topics</span>
				<input
					name="topics"
					class="w-full rounded border border-line bg-white px-3 py-2"
					placeholder="arrays, two pointers"
				/>
			</label>
			<button
				class="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong"
				type="submit"
			>
				<Plus size={18} aria-hidden="true" />
				Add problem
			</button>
		</form>
	</section>

	<section class="space-y-3">
		{#if data.problems.length === 0}
			<div class="rounded-lg border border-line bg-white/55 p-6 text-muted">
				No problems yet.
			</div>
		{:else}
			{#each data.problems as problem (problem.id)}
				<article class="rounded-lg border border-line bg-white/60 p-5">
					<div class="flex items-start justify-between gap-4">
						<div>
							<h2 class="text-xl font-semibold">{problem.title}</h2>
							<p class="mt-1 text-sm text-muted">{problem.slug}</p>
						</div>
						<a
							class="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm"
							href={problem.url}
							target="_blank"
							rel="noreferrer noopener"
						>
							<ExternalLink size={16} aria-hidden="true" />
							Open
						</a>
					</div>
					{#if problem.difficulty}
						<p class="mt-4 text-sm capitalize text-muted">
							{problem.difficulty}
						</p>
					{/if}
				</article>
			{/each}
		{/if}
	</section>
</main>
