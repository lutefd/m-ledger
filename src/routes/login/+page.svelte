<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
</script>

<svelte:head>
	<title>Login | Mistake Ledger</title>
</svelte:head>

<main
	class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12"
>
	<div class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-accent">
			Mistake Ledger
		</p>
		<h1 class="text-3xl font-semibold text-ink">Sign in</h1>
		<p class="text-muted">
			Review recurring mistakes before the next problem starts.
		</p>
	</div>

	<form
		method="POST"
		use:enhance
		class="mt-8 space-y-5 rounded-lg border border-line bg-white/60 p-6 shadow-sm"
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
			<span class="text-sm font-medium">Email</span>
			<input
				name="email"
				type="email"
				class="w-full rounded border border-line bg-white px-3 py-2"
				autocomplete="email"
				required
			/>
		</label>

		<label class="block space-y-2">
			<span class="text-sm font-medium">Password</span>
			<input
				name="password"
				type="password"
				class="w-full rounded border border-line bg-white px-3 py-2"
				autocomplete="current-password"
				required
			/>
		</label>

		<button
			class="w-full rounded bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong"
			type="submit">Sign in</button
		>
	</form>
</main>
