const GITHUB_API_URL = 'https://api.github.com';

export interface GitHubRepositoryInfo {
	fullName: string;
	defaultBranch: string;
}

export interface GitHubTreeEntry {
	path: string;
	type: string;
	sha: string;
}

export interface GitHubFileCommit {
	sha: string;
	date: string;
}

export interface GitHubClient {
	getRepository(repository: string): Promise<GitHubRepositoryInfo>;
	getTree(repository: string, branch: string): Promise<GitHubTreeEntry[]>;
	getLatestFileCommit(
		repository: string,
		path: string,
		branch: string
	): Promise<GitHubFileCommit>;
}

interface GitHubRepositoryResponse {
	full_name?: unknown;
	default_branch?: unknown;
}

interface GitHubTreeResponse {
	truncated?: unknown;
	tree?: unknown;
}

interface GitHubCommitResponse {
	sha?: unknown;
	commit?: {
		author?: { date?: unknown } | null;
		committer?: { date?: unknown } | null;
	} | null;
}

export function createGitHubClient(
	token: string,
	fetchImpl: typeof fetch = fetch
): GitHubClient {
	const request = async <T>(path: string): Promise<T> => {
		const response = await fetchImpl(`${GITHUB_API_URL}${path}`, {
			headers: {
				Accept: 'application/vnd.github+json',
				Authorization: `Bearer ${token}`,
				'X-GitHub-Api-Version': '2022-11-28'
			}
		});
		if (!response.ok) {
			throw new Error(
				`GitHub API request failed with status ${response.status}.`
			);
		}
		return (await response.json()) as T;
	};

	return {
		async getRepository(repository) {
			const payload = await request<GitHubRepositoryResponse>(
				`/repos/${encodeRepository(repository)}`
			);
			if (
				typeof payload.full_name !== 'string' ||
				typeof payload.default_branch !== 'string' ||
				!payload.default_branch
			) {
				throw new Error('GitHub returned an incomplete repository response.');
			}
			return {
				fullName: payload.full_name,
				defaultBranch: payload.default_branch
			};
		},

		async getTree(repository, branch) {
			const payload = await request<GitHubTreeResponse>(
				`/repos/${encodeRepository(repository)}/git/trees/${encodeURIComponent(branch)}?recursive=1`
			);
			if (payload.truncated === true) {
				throw new Error('GitHub returned a truncated repository tree.');
			}
			if (!Array.isArray(payload.tree)) {
				throw new Error('GitHub returned an incomplete repository tree.');
			}
			return payload.tree.flatMap((entry): GitHubTreeEntry[] => {
				if (!isRecord(entry)) return [];
				if (
					typeof entry.path !== 'string' ||
					typeof entry.type !== 'string' ||
					typeof entry.sha !== 'string'
				) {
					return [];
				}
				return [{ path: entry.path, type: entry.type, sha: entry.sha }];
			});
		},

		async getLatestFileCommit(repository, path, branch) {
			const payload = await request<unknown[]>(
				`/repos/${encodeRepository(repository)}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=1`
			);
			const first = payload[0];
			if (!isRecord(first)) {
				throw new Error(`GitHub returned no commit for ${path}.`);
			}
			const commit = first as GitHubCommitResponse;
			const date = commitDate(commit.commit);
			if (typeof commit.sha !== 'string' || typeof date !== 'string') {
				throw new Error(
					`GitHub returned incomplete commit metadata for ${path}.`
				);
			}
			return { sha: commit.sha, date };
		}
	};
}

function commitDate(commit: GitHubCommitResponse['commit']) {
	if (!isRecord(commit)) return undefined;
	for (const actor of [commit.committer, commit.author]) {
		if (isRecord(actor) && typeof actor.date === 'string') return actor.date;
	}
	return undefined;
}

function encodeRepository(repository: string) {
	return repository
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
