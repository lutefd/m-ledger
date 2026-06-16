<svelte:head>
	<title>Today | Mistake Ledger</title>
</svelte:head>

<main class="mx-auto max-w-6xl space-y-8 px-6 py-8">
	<section class="space-y-2">
		<p class="text-sm font-semibold uppercase tracking-wide text-accent">
			Today
		</p>
		<h1 class="text-3xl font-semibold">Start with the mistakes that repeat.</h1>
	</section>

	<section class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
		<div class="rounded-lg border border-line bg-white/55 p-5">
			<h2 class="text-xl font-semibold">Recurring mistakes</h2>
			<p class="mt-3 text-muted">
				Your next session briefing will appear here once attempts have enough
				history.
			</p>
		</div>
		<div class="rounded-lg border border-line bg-white/55 p-5">
			<h2 class="text-xl font-semibold">Due redos</h2>
			<p class="mt-3 text-muted">
				Problems with due redo dates will be queued here.
			</p>
		</div>
	</section>
</main>
