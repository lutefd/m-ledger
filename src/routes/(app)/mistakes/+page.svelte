<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus } from '@lucide/svelte';
	import { enhanceWithToast } from '$lib/utils/forms';

	let { data } = $props();
</script>

<svelte:head>
	<title>Mistakes | AlgoDrill</title>
</svelte:head>

<main class="page">
	<header class="page-head">
		<div class="min-w-0">
			<h1 class="page-title">Mistakes</h1>
			<p class="page-sub mt-1">
				Capture reusable mistakes and the guardrails that prevent them.
			</p>
		</div>
	</header>

	<div class="grid items-start gap-8 lg:grid-cols-[296px_1fr]">
		<section>
			<div class="section-label">
				<h2>Add mistake</h2>
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
						placeholder="Boundary condition"
						required
					/>
				</label>
				<label class="block space-y-1">
					<span class="field-label">Description</span>
					<textarea
						name="description"
						rows="2"
						class="input"
						placeholder="What tends to happen?"></textarea>
				</label>
				<label class="block space-y-1">
					<span class="field-label">Guardrail</span>
					<textarea
						name="guardrail"
						rows="2"
						class="input"
						placeholder="What check catches it?"></textarea>
				</label>
				<button class="btn btn-primary w-full" type="submit">
					<Plus size={15} aria-hidden="true" />
					Add mistake
				</button>
			</form>
		</section>

		<section>
			<div class="section-label">
				<h2>All mistakes</h2>
				<span class="tag">{data.mistakes.length}</span>
			</div>
			{#if data.mistakes.length === 0}
				<p class="empty">No mistakes yet.</p>
			{:else}
				<div class="panel rows">
					{#each data.mistakes as mistake (mistake.id)}
						<article class="row">
							<div class="min-w-0 flex-1">
								<h3 class="text-sm font-medium">
									<a class="link" href={`/mistakes/${mistake.id}`}>
										{mistake.name}
									</a>
								</h3>
								{#if mistake.guardrail}
									<p class="mt-0.5 text-xs text-muted">{mistake.guardrail}</p>
								{/if}
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>
