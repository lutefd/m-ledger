import { vi } from 'vitest';

// Tests never reach the network; services that need HTTP take an injected fetch.
vi.stubGlobal('fetch', async () => {
	throw new Error('Network access is disabled in tests.');
});
