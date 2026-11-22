<script lang="ts">
	import { enhance } from '$app/forms';
	import { enhanceWithToast } from '$lib/utils/forms';
</script>

<svelte:head>
	<title>Setup | AlgoDrill</title>
</svelte:head>

<main
	class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12"
>
	<div
		class="mb-8 flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight"
	>
		<span
			class="grid size-7 shrink-0 place-items-center rounded-md bg-fg text-sm font-bold text-bg"
			aria-hidden="true">A</span
		>
		<span>AlgoDrill</span>
	</div>

	<h1 class="page-title">Create the owner account</h1>
	<p class="mt-1.5 text-sm text-muted">
		This page disappears after the first account exists.
	</p>

	<form method="POST" use:enhance={enhanceWithToast} class="mt-8 space-y-4">
		<label class="block">
			<span class="field-label">Setup token</span>
			<input class="input" name="token" type="password" required />
		</label>
		<label class="block">
			<span class="field-label">Name</span>
			<input class="input" name="name" autocomplete="name" required />
		</label>
		<label class="block">
			<span class="field-label">Email</span>
			<input
				class="input"
				name="email"
				type="email"
				autocomplete="email"
				required
			/>
		</label>
		<label class="block">
			<span class="field-label">Password</span>
			<input
				class="input"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength="12"
				required
			/>
		</label>

		<button class="btn btn-primary btn-lg w-full" type="submit"
			>Create account</button
		>
	</form>
</main>
