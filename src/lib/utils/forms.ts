import { applyAction } from '$app/forms';
import type { SubmitFunction } from '@sveltejs/kit';
import { toast } from 'svelte-sonner';

type ActionData = {
	message?: unknown;
};

function actionMessage(data: unknown) {
	if (!data || typeof data !== 'object') return null;
	const message = (data as ActionData).message;
	return typeof message === 'string' && message.trim() ? message : null;
}

function errorMessage(error: unknown) {
	if (error instanceof Error && error.message.trim()) return error.message;
	if (error && typeof error === 'object' && 'message' in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === 'string' && message.trim()) return message;
	}
	return 'Something went wrong. Please try again.';
}

export const enhanceWithToast: SubmitFunction = () => {
	return async ({ result, update }) => {
		if (result.type === 'redirect') {
			await applyAction(result);
			return;
		}

		if (result.type === 'success') {
			const message = actionMessage(result.data);
			if (message) toast.success(message);
		} else if (result.type === 'failure') {
			toast.error(
				actionMessage(result.data) ?? 'Please check the form and try again.'
			);
		} else if (result.type === 'error') {
			toast.error(errorMessage(result.error));
		}

		await update();
	};
};
