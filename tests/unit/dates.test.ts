import { afterEach, describe, expect, it } from 'vitest';
import { isValidDateOnly, localDateOnly } from '../../src/lib/utils/dates';

describe('local calendar dates', () => {
	const previousTz = process.env.TZ;

	afterEach(() => {
		if (previousTz === undefined) delete process.env.TZ;
		else process.env.TZ = previousTz;
	});

	it('uses America/Sao_Paulo so late-evening local days are not UTC-shifted', () => {
		process.env.TZ = 'America/Sao_Paulo';
		// 23:30 in Sao Paulo on June 10 is already June 11 UTC.
		const lateEvening = new Date('2026-06-11T02:30:00.000Z');
		expect(localDateOnly(lateEvening, 'America/Sao_Paulo')).toBe('2026-06-10');
		expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-06-11');
	});

	it('validates YYYY-MM-DD calendar values', () => {
		expect(isValidDateOnly('2026-06-10')).toBe(true);
		expect(isValidDateOnly('2026-06-40')).toBe(false);
		expect(isValidDateOnly('06-10-2026')).toBe(false);
	});
});
