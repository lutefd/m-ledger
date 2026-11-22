<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	let { message }: { message?: string | null } = $props();

	onMount(() => {
		if (message) toast.error(message);
	});
</script>
