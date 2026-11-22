<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import {
		ExternalLink,
		Pause,
		Pencil,
		Play,
		Plus,
		Trash2
	} from '@lucide/svelte';
	import ToastOnMount from '$lib/components/ToastOnMount.svelte';
	import { formatClock, formatDuration } from '$lib/utils/time';
	import { enhanceWithToast } from '$lib/utils/forms';
	import { problemProviderLabel } from '$lib/utils/providers';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import type { RichTextDocument } from '$lib/server/validation/rich-text';

	let { data } = $props();
	const openSegment = $derived(
		data.segments.find((segment) => !segment.endedAt)
	);
	let renderedElapsed = $state(0);
	let notebook = $state<RichTextDocument | null>(
		data.session.notesDocument ? JSON.parse(data.session.notesDocument) : null
	);
	let saveState = $state<'saved' | 'saving' | 'error'>('saved');
	let saveTimer: number | undefined;
	let saveInFlight: Promise<void> | null = null;
	let notebookDirty = false;
	let resubmittingAfterSave = false;
	let showMistakeForm = $state(false);
	let showPatternForm = $state(false);
	let renaming = $state(false);

	const enhanceRename: SubmitFunction = async (input) => {
		const afterSubmit = await enhanceWithToast(input);
		return async (options) => {
			if (afterSubmit) await afterSubmit(options);
			if (options.result.type === 'success') renaming = false;
		};
	};

	function parseDocument(value: string | null): RichTextDocument | null {
		return value ? JSON.parse(value) : null;
	}

	$effect(() => {
		renderedElapsed = data.elapsedMs;
		if (!openSegment) return;
		const startedAt = new Date(openSegment.startedAt).getTime();
		const base = data.elapsedMs - Math.max(0, Date.now() - startedAt);
		const interval = window.setInterval(() => {
			renderedElapsed = base + Math.max(0, Date.now() - startedAt);
		}, 1000);
		return () => window.clearInterval(interval);
	});

	$effect(() => {
		const flushOnUnload = () => {
			if (!notebookDirty) return;
			window.clearTimeout(saveTimer);
			const body = new FormData();
			body.set('document', notebook ? JSON.stringify(notebook) : '');
			navigator.sendBeacon('?/notebook', body);
			notebookDirty = false;
		};
		window.addEventListener('beforeunload', flushOnUnload);
		return () => window.removeEventListener('beforeunload', flushOnUnload);
	});

	function confirmDelete(event: SubmitEvent) {
		if (
			!window.confirm(
				'Delete this session and all related attempts, timer segments, and briefing snapshots?'
			)
		) {
			event.preventDefault();
		}
	}

	function elapsedForAttempt(attemptId: string | null, tick: number) {
		void tick;
		if (!attemptId) return 0;
		return data.segments
			.filter((segment) => segment.attemptId === attemptId)
			.reduce((total, segment) => {
				const end = segment.endedAt ? new Date(segment.endedAt) : new Date();
				return (
					total +
					Math.max(0, end.getTime() - new Date(segment.startedAt).getTime())
				);
			}, 0);
	}

	function scheduleNotebookSave(document: RichTextDocument | null) {
		notebook = document;
		notebookDirty = true;
		saveState = 'saving';
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(saveNotebook, 750);
	}

	async function saveNotebook(): Promise<void> {
		window.clearTimeout(saveTimer);
		saveTimer = undefined;
		if (saveInFlight) {
			await saveInFlight;
			if (notebookDirty) return saveNotebook();
			return;
		}
		if (!notebookDirty) return;
		notebookDirty = false;
		const body = new FormData();
		body.set('document', notebook ? JSON.stringify(notebook) : '');
		saveInFlight = fetch('?/notebook', { method: 'POST', body })
			.then((response) => {
				saveState = response.ok ? 'saved' : 'error';
				if (!response.ok) notebookDirty = true;
			})
			.catch(() => {
				saveState = 'error';
				notebookDirty = true;
			})
			.finally(() => {
				saveInFlight = null;
			});
		await saveInFlight;
		if (notebookDirty && saveState !== 'error') await saveNotebook();
	}

	async function flushNotebookBeforeSubmit(event: SubmitEvent) {
		if (resubmittingAfterSave) {
			resubmittingAfterSave = false;
			return;
		}
		if (!notebookDirty && !saveInFlight && !saveTimer) return;
		event.preventDefault();
		await saveNotebook();
		if (saveState === 'error') return;
		resubmittingAfterSave = true;
		const form = event.currentTarget as HTMLFormElement;
		if (event.submitter instanceof HTMLElement) {
			form.requestSubmit(event.submitter);
		} else {
			form.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>
		{data.session.status === 'briefing' ? 'Session briefing' : 'Session'} | AlgoDrill
	</title>
</svelte:head>

<main class="page">
	<ToastOnMount message={data.message} />
	<header class="space-y-1">
		<p class="flex items-center gap-2 text-sm text-muted">
			{#if data.session.status === 'active'}
				<span class="size-1.5 rounded-full bg-live" aria-hidden="true"></span>
			{/if}
			<span class="capitalize">{data.session.status}</span>
		</p>
		<div class="flex flex-wrap items-end justify-between gap-4">
			{#if renaming}
				<form
					method="POST"
					action="?/rename"
					class="flex min-w-0 flex-1 flex-wrap items-center gap-2"
					use:enhance={enhanceRename}
				>
					<input
						name="name"
						class="input max-w-md text-base"
						value={data.session.name ?? ''}
						placeholder="Untitled session"
						aria-label="Session name"
						maxlength="80"
						onkeydown={(event) => {
							if (event.key === 'Escape') renaming = false;
						}}
						{@attach (node) => node.focus()}
					/>
					<button class="btn btn-primary" type="submit">Save name</button>
					<button
						class="btn btn-ghost"
						type="button"
						onclick={() => (renaming = false)}>Cancel</button
					>
				</form>
			{:else}
				<div class="flex min-w-0 items-center gap-1">
					<h1
						class={['page-title truncate', !data.session.name && 'text-muted']}
					>
						{data.session.name ?? 'Untitled session'}
					</h1>
					<button
						class="btn btn-ghost btn-icon"
						type="button"
						aria-label="Rename session"
						title="Rename session"
						onclick={() => (renaming = true)}
					>
						<Pencil size={15} aria-hidden="true" />
					</button>
				</div>
			{/if}
			<div
				class="font-mono text-[2.5rem] leading-none font-medium tabular-nums sm:text-[3.5rem] {openSegment
					? 'text-live'
					: 'text-fg'}"
			>
				{formatClock(renderedElapsed)}
			</div>
		</div>
	</header>
	{#if data.session.status === 'briefing'}
		<section class="grid gap-8 lg:grid-cols-2">
			<div>
				<h2 class="section-label">Recurring mistakes</h2>
				{#if data.briefingMistakes.length === 0}
					<p class="empty">No recurring mistakes qualified yet.</p>
				{:else}
					<div class="rows">
						{#each data.briefingMistakes as mistake (mistake.rank)}
							<article class="flex items-start justify-between gap-3 py-2.5">
								<div class="min-w-0">
									<h3 class="font-medium">{mistake.name}</h3>
									<p class="text-sm text-muted">
										{mistake.guardrail ?? 'No guardrail recorded.'}
									</p>
								</div>
								<span class="shrink-0 font-mono text-sm text-live"
									>×{mistake.occurrenceCount}</span
								>
							</article>
						{/each}
					</div>
				{/if}
			</div>
			<div>
				<h2 class="section-label">Due redos</h2>
				{#if data.briefingRedos.length === 0}
					<p class="empty">No redos due.</p>
				{:else}
					<div class="rows">
						{#each data.briefingRedos as redo (redo.rank)}
							<p class="flex items-baseline justify-between gap-3 py-2.5">
								<span class="font-medium">{redo.title}</span>
								<span class="font-mono text-sm text-muted">{redo.dueDate}</span>
							</p>
						{/each}
					</div>
				{/if}
			</div>
		</section>
		<form method="POST" action="?/acknowledge" use:enhance={enhanceWithToast}>
			<button class="btn btn-primary btn-lg" type="submit"
				>Acknowledge and start</button
			>
		</form>
	{:else}
		<section>
			<div class="mb-3 flex flex-wrap items-end justify-between gap-3">
				<h2 class="section-label !mb-0">Queue</h2>
				<form
					method="POST"
					action="?/addProblem"
					use:enhance={enhanceWithToast}
					class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
				>
					<select
						name="problemId"
						class="input sm:w-48"
						aria-label="Existing problem"
					>
						<option value="">Existing problem</option>
						{#each data.problems as problem (problem.id)}
							<option value={problem.id}>
								{problemProviderLabel(problem.provider)} · {problem.title}
							</option>
						{/each}
					</select>
					<input
						name="url"
						class="input sm:w-64"
						placeholder="https://.../problem"
						aria-label="Problem URL"
					/>
					<button class="btn btn-secondary py-2" type="submit">
						<Plus size={16} aria-hidden="true" />Add problem
					</button>
				</form>
			</div>
			<div class="panel rows">
				{#each data.queue as item (item.problemId)}
					<article
						class="row flex-wrap items-start {openSegment?.attemptId ===
							item.attemptId && item.attemptId
							? 'row-live'
							: ''}"
					>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<h3 class="font-medium">{item.title}</h3>
								<span class="tag">
									{problemProviderLabel(item.provider)}
								</span>
							</div>
							<p class="text-sm text-muted">
								{item.outcome ?? 'Not recapped'}
								{#if item.attemptId}
									· <span class="font-mono"
										>{formatDuration(
											elapsedForAttempt(item.attemptId, renderedElapsed)
										)}</span
									>
								{/if}
							</p>
							{#if item.notesDocument}
								<div class="mt-3 max-w-3xl">
									<p class="mb-2 text-sm font-medium">Recap notes</p>
									<RichTextEditor
										document={parseDocument(item.notesDocument)}
										editable={false}
										variant="recap"
									/>
								</div>
							{/if}
						</div>
						<div class="flex gap-2">
							<a
								class="btn btn-ghost btn-icon"
								href={item.url}
								target="_blank"
								rel="noreferrer noopener"
								aria-label={`Open ${item.title}`}
							>
								<ExternalLink size={16} aria-hidden="true" />
							</a>
							<form
								method="POST"
								action="?/activate"
								use:enhance={enhanceWithToast}
								onsubmit={flushNotebookBeforeSubmit}
							>
								<input type="hidden" name="problemId" value={item.problemId} />
								<button
									class="btn {openSegment?.attemptId === item.attemptId
										? 'btn-primary'
										: 'btn-secondary'}"
									type="submit"
								>
									<Play size={14} aria-hidden="true" />
									{openSegment?.attemptId === item.attemptId
										? 'Active'
										: 'Work'}
								</button>
							</form>
						</div>
					</article>
				{/each}
			</div>
		</section>
		<div class="flex flex-wrap items-center gap-3">
			{#if data.session.status === 'active'}
				<form
					method="POST"
					action="?/pause"
					use:enhance={enhanceWithToast}
					onsubmit={flushNotebookBeforeSubmit}
				>
					<button class="btn btn-secondary btn-lg" type="submit"
						><Pause size={16} />Stop work</button
					>
				</form>
			{/if}
			<form
				method="POST"
				action="?/complete"
				onsubmit={flushNotebookBeforeSubmit}
			>
				<button class="btn btn-primary btn-lg" type="submit"
					>Finish session / recap</button
				>
			</form>
			<p class="min-w-0 flex-1 basis-64 text-sm text-muted">
				Use Work to time a problem. Stop work closes the current timer; recap is
				where outcomes are saved.
			</p>
		</div>
		<section class="space-y-3">
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => {
						showMistakeForm = !showMistakeForm;
						showPatternForm = false;
					}}>New mistake</button
				>
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => {
						showPatternForm = !showPatternForm;
						showMistakeForm = false;
					}}>New pattern</button
				>
			</div>
			{#if showMistakeForm}
				<form
					method="POST"
					action="?/createMistake"
					use:enhance={enhanceWithToast}
					class="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
				>
					<input name="name" class="input" placeholder="Name" required />
					<input name="guardrail" class="input" placeholder="Guardrail" />
					<button class="btn btn-secondary" type="submit">Create</button>
				</form>
			{/if}
			{#if showPatternForm}
				<form
					method="POST"
					action="?/createPattern"
					use:enhance={enhanceWithToast}
					class="grid gap-2 md:grid-cols-[1fr_1fr_auto]"
				>
					<input name="name" class="input" placeholder="Name" required />
					<input
						name="recognitionTrigger"
						class="input"
						placeholder="Recognition trigger"
					/>
					<button class="btn btn-secondary" type="submit">Create</button>
				</form>
			{/if}
		</section>
	{/if}

	<section>
		<div class="mb-3 flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 class="font-medium">
					{data.session.status === 'completed' ? 'Session brief' : 'Notebook'}
				</h2>
				<p class="text-sm text-muted">
					{data.session.status === 'completed'
						? 'Notes captured while working. This is read-only after completion.'
						: saveState === 'saving'
							? 'Saving'
							: saveState === 'error'
								? 'Could not save'
								: 'Saved automatically'}
				</p>
			</div>
			<form method="POST" action="?/delete" onsubmit={confirmDelete}>
				<button class="btn btn-danger" type="submit">
					<Trash2 size={14} aria-hidden="true" />
					Delete
				</button>
			</form>
		</div>
		{#if data.session.status === 'completed' && !notebook}
			<p class="empty">No session brief was recorded.</p>
		{:else}
			<RichTextEditor
				document={notebook}
				variant="notebook"
				editable={data.session.status !== 'completed'}
				onChange={data.session.status === 'completed'
					? undefined
					: scheduleNotebookSave}
			/>
		{/if}
	</section>
</main>
