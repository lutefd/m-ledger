import { count } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { users } from '$lib/server/db/schema';

export async function countUsers(db: Db): Promise<number> {
	const [row] = await db.select({ value: count() }).from(users);
	return row?.value ?? 0;
}
