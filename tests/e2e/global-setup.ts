import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

export default function globalSetup() {
	const databasePath = resolve('.data/algodrill-e2e.sqlite');
	for (const path of [
		databasePath,
		`${databasePath}-wal`,
		`${databasePath}-shm`
	]) {
		rmSync(path, { force: true });
	}
}
