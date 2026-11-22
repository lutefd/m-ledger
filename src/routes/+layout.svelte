<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import { Toaster } from 'svelte-sonner';
	import { preferences } from '$lib/ui/preferences.svelte';
	import '../app.css';

	let { data, children } = $props();

	// The store is module state, so only the browser may seed it; the server
	// renders straight from this request's cookies.
	if (browser) Object.assign(preferences, data.preferences);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<Toaster
	position="top-right"
	theme={browser ? preferences.theme : data.preferences.theme}
	closeButton
/>

{@render children()}
