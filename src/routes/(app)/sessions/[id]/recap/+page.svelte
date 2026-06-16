<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const attempts = $derived(data.queue.filter((item) => item.attemptId));
</script>

<main class="mx-auto max-w-5xl px-6 py-8">
	<h1 class="text-3xl font-semibold">Session recap</h1>
	<p class="mt-3 text-muted">
		Record the outcome, confidence, mistakes, patterns, notes, and redo date for
		every activated problem.
	</p>
	<form method="POST" use:enhance class="mt-6 space-y-5">
		{#if form?.message}
			<p
				class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
			>
				{form.message}
			</p>
		{/if}
		{#if attempts.length === 0}
			<div class="rounded-lg border border-line bg-white/60 p-5 text-muted">
				No activated attempts yet.
			</div>
		{:else}
			{#each attempts as attempt (attempt.attemptId)}
				<section class="rounded-lg border border-line bg-white/60 p-5">
					<input type="hidden" name="attemptId" value={attempt.attemptId} />
					<h2 class="text-xl font-semibold">{attempt.title}</h2>
					<div class="mt-4 grid gap-4 md:grid-cols-2">
						<label class="block space-y-2">
							<span class="text-sm font-medium">Outcome</span>
							<select
								name={`outcome:${attempt.attemptId}`}
								class="w-full rounded border border-line bg-white px-3 py-2"
								required
							>
								<option value="">Choose</option>
								<option value="solved_independently"
									>Solved independently</option
								>
								<option value="solved_with_help">Solved with help</option>
								<option value="partial">Partial</option>
								<option value="stuck">Stuck</option>
							</select>
						</label>
						<label class="block space-y-2">
							<span class="text-sm font-medium">Confidence</span>
							<select
								name={`confidence:${attempt.attemptId}`}
								class="w-full rounded border border-line bg-white px-3 py-2"
								required
							>
								<option value="">Choose</option>
								{#each [1, 2, 3, 4, 5] as value (value)}
									<option {value}>{value}</option>
								{/each}
							</select>
						</label>
					</div>
					<label class="mt-4 block space-y-2">
						<span class="text-sm font-medium">Redo date</span>
						<input
							name={`redoDate:${attempt.attemptId}`}
							type="date"
							class="w-full rounded border border-line bg-white px-3 py-2"
						/>
					</label>
					<label class="mt-4 block space-y-2">
						<span class="text-sm font-medium">Notes</span>
						<textarea
							name={`notes:${attempt.attemptId}`}
							class="min-h-24 w-full rounded border border-line bg-white px-3 py-2"
						></textarea>
					</label>
					<div class="mt-4 grid gap-4 md:grid-cols-2">
						<fieldset class="space-y-2">
							<legend class="text-sm font-medium">Mistakes</legend>
							{#each data.mistakes as mistake (mistake.id)}
								<label class="flex gap-2 text-sm"
									><input
										type="checkbox"
										name={`mistakes:${attempt.attemptId}`}
										value={mistake.id}
									/>{mistake.name}</label
								>
							{/each}
						</fieldset>
						<fieldset class="space-y-2">
							<legend class="text-sm font-medium">Patterns</legend>
							{#each data.patterns as pattern (pattern.id)}
								<label class="flex gap-2 text-sm"
									><input
										type="checkbox"
										name={`patterns:${attempt.attemptId}`}
										value={pattern.id}
									/>{pattern.name}</label
								>
							{/each}
						</fieldset>
					</div>
				</section>
			{/each}
			<button
				class="rounded bg-accent px-4 py-2 font-semibold text-white"
				type="submit">Save recap</button
			>
		{/if}
	</form>
</main>
