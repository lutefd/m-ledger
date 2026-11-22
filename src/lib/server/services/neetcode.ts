import { and, desc, eq } from 'drizzle-orm';
import type { Db } from '$lib/server/db/client';
import { externalSolves, problems, users } from '$lib/server/db/schema';
import { env } from '$lib/server/env';
import { isoNow } from '$lib/utils/dates';
import { canonicalProblemUrl } from './problems';
import { createGitHubClient, type GitHubClient } from './github';
import { reconcileExternalSolveLinks } from './external-solve-links';
import { titleFromSlug } from './normalize';

const submissionPathPattern =
	/^([^/]+)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/submission-(\d+)\.([a-z0-9]+)$/i;

const languageByExtension: Record<string, string> = {
	c: 'C',
	cc: 'C++',
	cpp: 'C++',
	cxx: 'C++',
	cs: 'C#',
	go: 'Go',
	java: 'Java',
	js: 'JavaScript',
	jsx: 'JavaScript',
	kt: 'Kotlin',
	php: 'PHP',
	py: 'Python',
	rb: 'Ruby',
	rs: 'Rust',
	scala: 'Scala',
	sh: 'Shell',
	sql: 'SQL',
	swift: 'Swift',
	ts: 'TypeScript',
	tsx: 'TypeScript'
};

export interface ParsedNeetCodeSubmission {
	course: string;
	slug: string;
	title: string;
	submissionIndex: number;
	extension: string;
	language: string;
	url: string;
}

export interface NeetCodeSubmissionInput {
	repository: string;
	path: string;
	commitSha: string;
	submittedAt: string;
	sourceCodeUrl?: string;
}

export interface NeetCodeImportResult {
	imported: number;
	updated: number;
	ignored: number;
	problemsCreated: number;
}

export interface NeetCodeConfig {
	repository: string;
	importUserEmail: string;
	webhookSecret?: string;
	apiToken?: string;
}

export function languageFromExtension(extension: string) {
	return languageByExtension[extension.toLowerCase()] ?? null;
}

export function parseNeetCodeSubmissionPath(
	path: string
): ParsedNeetCodeSubmission | null {
	const match = submissionPathPattern.exec(path);
	if (!match) return null;
	const [, course, rawSlug, rawIndex, extension] = match;
	const language = languageFromExtension(extension);
	if (!language) return null;
	const slug = rawSlug.toLowerCase();
	return {
		course,
		slug,
		title: titleFromSlug(slug),
		submissionIndex: Number(rawIndex),
		extension: extension.toLowerCase(),
		language,
		url: canonicalProblemUrl('neetcode', slug)
	};
}

export function sourceCodeUrl(
	repository: string,
	commitSha: string,
	path: string
) {
	const encodedPath = path
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
	return `https://github.com/${repository}/blob/${encodeURIComponent(commitSha)}/${encodedPath}`;
}

export function getNeetCodeConfig(): NeetCodeConfig {
	const repository = configuredValue(
		'NEETCODE_GITHUB_REPOSITORY',
		env.NEETCODE_GITHUB_REPOSITORY
	);
	const importUserEmail = configuredValue(
		'NEETCODE_IMPORT_USER_EMAIL',
		env.NEETCODE_IMPORT_USER_EMAIL
	);
	const webhookSecret = configuredValue(
		'GITHUB_WEBHOOK_SECRET',
		env.GITHUB_WEBHOOK_SECRET
	);
	const apiToken = configuredValue('GITHUB_API_TOKEN', env.GITHUB_API_TOKEN);
	if (!repository || !importUserEmail) {
		const missing = [
			!repository ? 'NEETCODE_GITHUB_REPOSITORY' : null,
			!importUserEmail ? 'NEETCODE_IMPORT_USER_EMAIL' : null
		].filter((value): value is string => Boolean(value));
		throw new Error(
			`NeetCode GitHub sync is not configured: ${missing.join(', ')}.`
		);
	}
	if (!/^([^/]+)\/([^/]+)$/.test(repository)) {
		throw new Error(
			'NEETCODE_GITHUB_REPOSITORY must use owner/repository format.'
		);
	}
	return {
		repository,
		importUserEmail,
		webhookSecret,
		apiToken
	};
}

export function getWebhookConfig() {
	const config = getNeetCodeConfig();
	if (!config.webhookSecret) {
		throw new Error(
			'NeetCode GitHub sync is not configured: GITHUB_WEBHOOK_SECRET.'
		);
	}
	return { ...config, webhookSecret: config.webhookSecret };
}

export function requireConfiguredImportUser(
	userEmail: string,
	config: NeetCodeConfig
) {
	if (userEmail.toLowerCase() !== config.importUserEmail.toLowerCase()) {
		throw new Error(
			'The signed-in account is not the configured NeetCode import user.'
		);
	}
}

export async function configuredImportUserId(db: Db, config: NeetCodeConfig) {
	const user = await db.query.users.findFirst({
		where: eq(users.email, config.importUserEmail)
	});
	return user?.id ?? null;
}

export function importNeetCodeSubmissions(
	db: Db,
	userId: string,
	inputs: NeetCodeSubmissionInput[]
): NeetCodeImportResult {
	const uniqueInputs = new Map<string, NeetCodeSubmissionInput>();
	for (const input of inputs) {
		uniqueInputs.set(`${input.repository}\u0000${input.path}`, input);
	}

	const importedSolveIds: string[] = [];
	const result = db.transaction((tx) => {
		let imported = 0;
		let updated = 0;
		let ignored = 0;
		let problemsCreated = 0;

		for (const input of uniqueInputs.values()) {
			const parsed = parseNeetCodeSubmissionPath(input.path);
			if (!parsed) {
				ignored += 1;
				continue;
			}
			validateSubmissionInput(input);
			const existingProblem = tx.query.problems
				.findFirst({
					where: and(eq(problems.userId, userId), eq(problems.url, parsed.url))
				})
				.sync();
			let problem = existingProblem;
			if (!problem) {
				const now = isoNow();
				const problemId = crypto.randomUUID();
				tx.insert(problems)
					.values({
						id: problemId,
						userId,
						provider: 'neetcode',
						url: parsed.url,
						slug: parsed.slug,
						title: parsed.title,
						createdAt: now,
						updatedAt: now
					})
					.run();
				problem = tx.query.problems
					.findFirst({ where: eq(problems.id, problemId) })
					.sync()!;
				problemsCreated += 1;
			}

			const existingSolve = tx.query.externalSolves
				.findFirst({
					where: and(
						eq(externalSolves.repository, input.repository),
						eq(externalSolves.submissionPath, input.path)
					)
				})
				.sync();
			const solveData = {
				userId,
				problemId: problem.id,
				repository: input.repository,
				submissionPath: input.path,
				submissionIndex: parsed.submissionIndex,
				language: parsed.language,
				commitSha: input.commitSha,
				submittedAt: input.submittedAt,
				sourceCodeUrl:
					input.sourceCodeUrl ??
					sourceCodeUrl(input.repository, input.commitSha, input.path)
			};
			if (existingSolve) {
				tx.update(externalSolves)
					.set(solveData)
					.where(eq(externalSolves.id, existingSolve.id))
					.run();
				importedSolveIds.push(existingSolve.id);
				updated += 1;
			} else {
				const externalSolveId = crypto.randomUUID();
				tx.insert(externalSolves)
					.values({
						id: externalSolveId,
						...solveData,
						importedAt: isoNow()
					})
					.run();
				importedSolveIds.push(externalSolveId);
				imported += 1;
			}
		}

		return { imported, updated, ignored, problemsCreated };
	});
	reconcileExternalSolveLinks(db, importedSolveIds);
	return result;
}

export async function syncNeetCodeHistory(
	db: Db,
	userId: string,
	options: {
		config?: NeetCodeConfig;
		client?: GitHubClient;
	} = {}
) {
	const config = options.config ?? getNeetCodeConfig();
	if (!config.apiToken && !options.client) {
		throw new Error(
			'NeetCode GitHub sync requires GITHUB_API_TOKEN for history sync.'
		);
	}
	const client =
		options.client ?? createGitHubClient(config.apiToken as string);
	const repository = await client.getRepository(config.repository);
	if (!sameRepository(repository.fullName, config.repository)) {
		throw new Error('GitHub returned an unexpected repository.');
	}
	const entries = await client.getTree(
		config.repository,
		repository.defaultBranch
	);
	const paths = entries.filter((entry) => entry.type === 'blob');
	const submissionResults = await Promise.all(
		paths.map(async (entry) => {
			if (!parseNeetCodeSubmissionPath(entry.path)) return null;
			const commit = await client.getLatestFileCommit(
				config.repository,
				entry.path,
				repository.defaultBranch
			);
			return {
				repository: config.repository,
				path: entry.path,
				commitSha: commit.sha,
				submittedAt: commit.date,
				sourceCodeUrl: sourceCodeUrl(config.repository, commit.sha, entry.path)
			};
		})
	);
	const submissions: NeetCodeSubmissionInput[] = [];
	for (const result of submissionResults) {
		if (result) submissions.push(result);
	}

	return importNeetCodeSubmissions(db, userId, submissions);
}

export async function listExternalSolves(db: Db, userId: string, limit = 100) {
	return db
		.select({
			id: externalSolves.id,
			submissionPath: externalSolves.submissionPath,
			submissionIndex: externalSolves.submissionIndex,
			language: externalSolves.language,
			commitSha: externalSolves.commitSha,
			submittedAt: externalSolves.submittedAt,
			sourceCodeUrl: externalSolves.sourceCodeUrl,
			problemId: problems.id,
			problemTitle: problems.title,
			problemSlug: problems.slug,
			provider: problems.provider
		})
		.from(externalSolves)
		.innerJoin(problems, eq(problems.id, externalSolves.problemId))
		.where(eq(externalSolves.userId, userId))
		.orderBy(desc(externalSolves.submittedAt))
		.limit(limit);
}

function configuredValue(name: string, fallback: string | undefined) {
	return process.env[name]?.trim() || fallback?.trim();
}

function validateSubmissionInput(input: NeetCodeSubmissionInput) {
	if (!input.repository.trim())
		throw new Error('Submission repository is required.');
	if (!input.commitSha.trim())
		throw new Error('Submission commit SHA is required.');
	if (Number.isNaN(new Date(input.submittedAt).getTime())) {
		throw new Error('Submission timestamp must be a valid ISO date.');
	}
}

function sameRepository(left: string, right: string) {
	return left.toLowerCase() === right.toLowerCase();
}

export interface NeetCodePushPayload {
	repository?: {
		full_name?: unknown;
		default_branch?: unknown;
	};
	ref?: unknown;
	commits?: unknown;
	head_commit?: unknown;
}

export function validateNeetCodePush(
	payload: NeetCodePushPayload,
	configuredRepository: string
) {
	const repository = payload.repository;
	if (
		!repository ||
		typeof repository.full_name !== 'string' ||
		!sameRepository(repository.full_name, configuredRepository)
	) {
		return { accepted: false, reason: 'repository' as const };
	}
	if (
		typeof repository.default_branch !== 'string' ||
		typeof payload.ref !== 'string' ||
		payload.ref !== `refs/heads/${repository.default_branch}`
	) {
		return { accepted: false, reason: 'branch' as const };
	}
	return { accepted: true as const };
}

export function submissionsFromNeetCodePush(
	payload: NeetCodePushPayload,
	repository: string
): NeetCodeSubmissionInput[] {
	if (!Array.isArray(payload.commits)) return [];
	const submissions = new Map<string, NeetCodeSubmissionInput>();
	for (const value of payload.commits) {
		if (!isRecord(value)) continue;
		const commitSha = typeof value.id === 'string' ? value.id : null;
		const submittedAt = commitDate(value);
		if (!commitSha || !submittedAt) continue;
		if (!Array.isArray(value.added)) continue;
		for (const path of value.added) {
			if (typeof path !== 'string' || !parseNeetCodeSubmissionPath(path))
				continue;
			submissions.set(`${repository}\u0000${path}`, {
				repository,
				path,
				commitSha,
				submittedAt,
				sourceCodeUrl: sourceCodeUrl(repository, commitSha, path)
			});
		}
	}
	return [...submissions.values()];
}

function commitDate(value: Record<string, unknown>) {
	const direct = typeof value.timestamp === 'string' ? value.timestamp : null;
	if (direct) return direct;
	for (const key of ['committer', 'author']) {
		const actor = value[key];
		if (isRecord(actor) && typeof actor.date === 'string') return actor.date;
	}
	return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
