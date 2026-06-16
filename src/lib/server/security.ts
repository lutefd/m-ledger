import { timingSafeEqual } from 'node:crypto';

export function timingSafeTokenEqual(
	actual: string,
	expected: string
): boolean {
	const actualBuffer = Buffer.from(actual);
	const expectedBuffer = Buffer.from(expected);
	if (actualBuffer.length !== expectedBuffer.length) return false;
	return timingSafeEqual(actualBuffer, expectedBuffer);
}
