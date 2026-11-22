<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus } from '@lucide/svelte';
	import { enhanceWithToast } from '$lib/utils/forms';

	let { data } = $props();
</script>

<svelte:head>
	<title>Patterns | AlgoDrill</title>
</svelte:head>

<main class="page">
	<header class="page-head">
		<div class="min-w-0">
			<h1 class="page-title">Patterns</h1>
			<p class="page-sub mt-1">
				Name patterns and the trigger that should make them recognizable.
			</p>
		</div>
	</header>

	<div class="grid items-start gap-8 lg:grid-cols-[296px_1fr]">
		<section>
			<div class="section-label">
				<h2>Add pattern</h2>
			</div>
			<form
				method="POST"
				use:enhance={enhanceWithToast}
				class="panel space-y-3 p-4"
			>
				<label class="block space-y-1">
					<span class="field-label">Name</span>
					<input
						name="name"
						class="input"
						placeholder="Sliding window"
						required
					/>
				</label>
				<label class="block space-y-1">
					<span class="field-label">Recognition trigger</span>
					<textarea
						name="recognitionTrigger"
						rows="3"
						class="input"
						placeholder="When should this pattern come to mind?"></textarea>
				</label>
				<button class="btn btn-primary w-full" type="submit">
					<Plus size={15} aria-hidden="true" />
					Add pattern
				</button>
			</form>
		</section>

		<section>
			<div class="section-label">
				<h2>All patterns</h2>
				<span class="tag">{data.patterns.length}</span>
			</div>
			{#if data.patterns.length === 0}
				<p class="empty">No patterns yet.</p>
			{:else}
				<div class="panel rows">
					{#each data.patterns as pattern (pattern.id)}
						<article class="row">
							<div class="min-w-0 flex-1">
								<h3 class="text-sm font-medium">{pattern.name}</h3>
								{#if pattern.recognitionTrigger}
									<p class="mt-0.5 text-xs text-muted">
										{pattern.recognitionTrigger}
									</p>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>
