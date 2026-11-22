<script lang="ts">
	import { enhance } from '$app/forms';
	import { enhanceWithToast } from '$lib/utils/forms';
</script>

<svelte:head>
	<title>Login | AlgoDrill</title>
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

	<h1 class="page-title">Sign in</h1>
	<p class="mt-1.5 text-sm text-muted">
		Review recurring traps before the next coding problem starts.
	</p>

	<form method="POST" use:enhance={enhanceWithToast} class="mt-8 space-y-4">
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
				autocomplete="current-password"
				required
			/>
		</label>

		<button class="btn btn-primary btn-lg w-full" type="submit">Sign in</button>
	</form>
</main>
