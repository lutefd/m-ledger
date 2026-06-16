import { sql } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';

export async function GET() {
	await db.get(sql`select 1`);
	return json({ ok: true });
}
