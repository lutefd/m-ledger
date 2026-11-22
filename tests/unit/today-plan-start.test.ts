import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/services/daily-plans', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('$lib/server/services/daily-plans')>();
	return {
		...actual,
		startSessionFromDailyPlan: vi.fn()
	};
});

import { actions } from '../../src/routes/(app)/today/+page.server';
import {
	DailyPlanError,
	startSessionFromDailyPlan
} from '$lib/server/services/daily-plans';

const startPlan = actions.startPlan;
const startSession = vi.mocked(startSessionFromDailyPlan);

const event = {
	locals: {
		user: { id: 'user-1' },
		session: { id: 'auth-session' }
	}
} as Parameters<NonNullable<typeof startPlan>>[0];

describe('Today start from plan', () => {
	beforeEach(() => {
		startSession.mockReset();
	});

	it('redirects Luis to the study session', async () => {
		startSession.mockResolvedValue('sess-1');
		await expect(startPlan(event)).rejects.toMatchObject({
			status: 303,
			location: '/sessions/sess-1'
		});
	});

	it('returns the plan error on the form instead of throwing it', async () => {
		startSession.mockRejectedValue(
			new DailyPlanError(
				'Finish or abandon the open session before starting this plan.',
				409
			)
		);
		await expect(startPlan(event)).resolves.toMatchObject({
			status: 409,
			data: {
				message: 'Finish or abandon the open session before starting this plan.'
			}
		});
	});

	it('returns other start failures as a form message', async () => {
		startSession.mockRejectedValue(
			new Error('Finish or abandon the open session before starting a new one.')
		);
		await expect(startPlan(event)).resolves.toMatchObject({
			status: 400,
			data: {
				message: 'Finish or abandon the open session before starting a new one.'
			}
		});
	});
});
