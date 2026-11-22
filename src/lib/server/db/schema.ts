import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const bool = (name: string) => integer(name, { mode: 'boolean' });
const iso = (name: string) => text(name);

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull(),
		emailVerified: bool('email_verified').notNull().default(false),
		image: text('image'),
		createdAt: timestamp('created_at')
			.notNull()
			.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`),
		updatedAt: timestamp('updated_at')
			.notNull()
			.default(sql`(cast((julianday('now') - 2440587.5)*86400000 as integer))`)
	},
	(table) => [uniqueIndex('users_email_unique').on(table.email)]
);

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
	},
	(table) => [
		uniqueIndex('sessions_token_unique').on(table.token),
		index('sessions_user_id_idx').on(table.userId)
	]
);

export const accounts = sqliteTable(
	'accounts',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull()
	},
	(table) => [index('accounts_user_id_idx').on(table.userId)]
);

export const verifications = sqliteTable(
	'verifications',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').notNull(),
		updatedAt: timestamp('updated_at').notNull()
	},
	(table) => [index('verifications_identifier_idx').on(table.identifier)]
);

export const problems = sqliteTable(
	'problems',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		provider: text('provider', {
			enum: ['leetcode', 'neetcode', 'hackerrank', 'other']
		})
			.notNull()
			.default('leetcode'),
		url: text('url').notNull(),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }),
		createdAt: iso('created_at').notNull(),
		updatedAt: iso('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('problems_user_url_unique').on(table.userId, table.url),
		index('problems_user_slug_idx').on(table.userId, table.slug),
		index('problems_user_created_idx').on(table.userId, table.createdAt)
	]
);

export const externalSolves = sqliteTable(
	'external_solves',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		problemId: text('problem_id')
			.notNull()
			.references(() => problems.id, { onDelete: 'cascade' }),
		repository: text('repository').notNull(),
		submissionPath: text('submission_path').notNull(),
		submissionIndex: integer('submission_index').notNull(),
		language: text('language').notNull(),
		commitSha: text('commit_sha').notNull(),
		submittedAt: iso('submitted_at').notNull(),
		sourceCodeUrl: text('source_code_url').notNull(),
		importedAt: iso('imported_at').notNull()
	},
	(table) => [
		uniqueIndex('external_solves_repository_path_unique').on(
			table.repository,
			table.submissionPath
		),
		index('external_solves_user_submitted_idx').on(
			table.userId,
			table.submittedAt
		),
		index('external_solves_user_problem_idx').on(table.userId, table.problemId)
	]
);

export const topics = sqliteTable(
	'topics',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		normalizedName: text('normalized_name').notNull()
	},
	(table) => [
		uniqueIndex('topics_user_normalized_unique').on(
			table.userId,
			table.normalizedName
		)
	]
);

export const problemTopics = sqliteTable(
	'problem_topics',
	{
		problemId: text('problem_id')
			.notNull()
			.references(() => problems.id, { onDelete: 'cascade' }),
		topicId: text('topic_id')
			.notNull()
			.references(() => topics.id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.problemId, table.topicId] }),
		index('problem_topics_topic_idx').on(table.topicId)
	]
);

export const mistakes = sqliteTable(
	'mistakes',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		normalizedName: text('normalized_name').notNull(),
		description: text('description'),
		guardrail: text('guardrail'),
		archived: bool('archived').notNull().default(false)
	},
	(table) => [
		uniqueIndex('mistakes_user_normalized_unique').on(
			table.userId,
			table.normalizedName
		),
		index('mistakes_user_archived_idx').on(table.userId, table.archived)
	]
);

export const patterns = sqliteTable(
	'patterns',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		normalizedName: text('normalized_name').notNull(),
		recognitionTrigger: text('recognition_trigger'),
		archived: bool('archived').notNull().default(false)
	},
	(table) => [
		uniqueIndex('patterns_user_normalized_unique').on(
			table.userId,
			table.normalizedName
		),
		index('patterns_user_archived_idx').on(table.userId, table.archived)
	]
);

export const studySessions = sqliteTable(
	'study_sessions',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		status: text('status', {
			enum: ['briefing', 'active', 'paused', 'completed']
		}).notNull(),
		startedAt: iso('started_at').notNull(),
		finishedAt: iso('finished_at'),
		notes: text('notes'),
		notesDocument: text('notes_document')
	},
	(table) => [
		index('study_sessions_user_started_idx').on(table.userId, table.startedAt),
		index('study_sessions_user_status_idx').on(table.userId, table.status)
	]
);

export const sessionQueue = sqliteTable(
	'session_queue',
	{
		sessionId: text('session_id')
			.notNull()
			.references(() => studySessions.id, { onDelete: 'cascade' }),
		problemId: text('problem_id')
			.notNull()
			.references(() => problems.id, { onDelete: 'cascade' }),
		position: integer('position').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.sessionId, table.problemId] }),
		uniqueIndex('session_queue_position_unique').on(
			table.sessionId,
			table.position
		)
	]
);

export const attempts = sqliteTable(
	'attempts',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sessionId: text('session_id')
			.notNull()
			.references(() => studySessions.id, { onDelete: 'cascade' }),
		problemId: text('problem_id')
			.notNull()
			.references(() => problems.id, { onDelete: 'cascade' }),
		outcome: text('outcome', {
			enum: ['solved_independently', 'solved_with_help', 'partial', 'stuck']
		}),
		confidence: integer('confidence'),
		notes: text('notes'),
		notesDocument: text('notes_document'),
		redoDate: text('redo_date'),
		createdAt: iso('created_at').notNull(),
		completedAt: iso('completed_at')
	},
	(table) => [
		uniqueIndex('attempts_session_problem_unique').on(
			table.sessionId,
			table.problemId
		),
		index('attempts_user_problem_completed_idx').on(
			table.userId,
			table.problemId,
			table.completedAt
		),
		index('attempts_user_redo_idx').on(table.userId, table.redoDate),
		index('attempts_user_completed_idx').on(table.userId, table.completedAt)
	]
);

export const attemptMistakes = sqliteTable(
	'attempt_mistakes',
	{
		attemptId: text('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		mistakeId: text('mistake_id')
			.notNull()
			.references(() => mistakes.id, { onDelete: 'cascade' }),
		note: text('occurrence_note')
	},
	(table) => [
		primaryKey({ columns: [table.attemptId, table.mistakeId] }),
		index('attempt_mistakes_mistake_idx').on(table.mistakeId)
	]
);

export const attemptPatterns = sqliteTable(
	'attempt_patterns',
	{
		attemptId: text('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		patternId: text('pattern_id')
			.notNull()
			.references(() => patterns.id, { onDelete: 'cascade' }),
		note: text('trigger_note')
	},
	(table) => [
		primaryKey({ columns: [table.attemptId, table.patternId] }),
		index('attempt_patterns_pattern_idx').on(table.patternId)
	]
);

export const timerSegments = sqliteTable(
	'timer_segments',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sessionId: text('session_id')
			.notNull()
			.references(() => studySessions.id, { onDelete: 'cascade' }),
		attemptId: text('attempt_id').references(() => attempts.id, {
			onDelete: 'cascade'
		}),
		startedAt: iso('started_at').notNull(),
		endedAt: iso('ended_at')
	},
	(table) => [
		index('timer_segments_session_idx').on(table.sessionId),
		index('timer_segments_attempt_idx').on(table.attemptId),
		uniqueIndex('timer_segments_one_open_per_session')
			.on(table.sessionId)
			.where(sql`ended_at is null`)
	]
);

export const externalSolveLinks = sqliteTable(
	'external_solve_links',
	{
		id: text('id').primaryKey(),
		externalSolveId: text('external_solve_id')
			.notNull()
			.references(() => externalSolves.id, { onDelete: 'cascade' }),
		attemptId: text('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		method: text('method', { enum: ['time_window', 'manual'] }).notNull(),
		confidence: text('confidence', {
			enum: ['high', 'medium', 'low']
		}).notNull(),
		createdAt: iso('created_at').notNull()
	},
	(table) => [
		uniqueIndex('external_solve_links_external_unique').on(
			table.externalSolveId
		),
		uniqueIndex('external_solve_links_pair_unique').on(
			table.externalSolveId,
			table.attemptId
		),
		index('external_solve_links_attempt_idx').on(table.attemptId)
	]
);

export const briefings = sqliteTable(
	'briefings',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		sessionId: text('session_id')
			.notNull()
			.references(() => studySessions.id, { onDelete: 'cascade' }),
		createdAt: iso('created_at').notNull(),
		acknowledgedAt: iso('acknowledged_at')
	},
	(table) => [
		uniqueIndex('briefings_session_unique').on(table.sessionId),
		index('briefings_user_created_idx').on(table.userId, table.createdAt)
	]
);

export const briefingMistakes = sqliteTable(
	'briefing_mistakes',
	{
		briefingId: text('briefing_id')
			.notNull()
			.references(() => briefings.id, { onDelete: 'cascade' }),
		mistakeId: text('mistake_id')
			.notNull()
			.references(() => mistakes.id, { onDelete: 'cascade' }),
		rank: integer('rank').notNull(),
		score: integer('score').notNull(),
		occurrenceCount: integer('occurrence_count').notNull(),
		lastOccurrence: iso('last_occurrence').notNull(),
		averageConfidence: integer('average_confidence').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.briefingId, table.mistakeId] }),
		uniqueIndex('briefing_mistakes_rank_unique').on(
			table.briefingId,
			table.rank
		)
	]
);

export const briefingRedos = sqliteTable(
	'briefing_redos',
	{
		briefingId: text('briefing_id')
			.notNull()
			.references(() => briefings.id, { onDelete: 'cascade' }),
		problemId: text('problem_id')
			.notNull()
			.references(() => problems.id, { onDelete: 'cascade' }),
		attemptId: text('attempt_id')
			.notNull()
			.references(() => attempts.id, { onDelete: 'cascade' }),
		dueDate: text('due_date').notNull(),
		rank: integer('rank').notNull()
	},
	(table) => [
		primaryKey({ columns: [table.briefingId, table.problemId] }),
		uniqueIndex('briefing_redos_rank_unique').on(table.briefingId, table.rank)
	]
);

/** Bot (or manual) ordered drill plan for a calendar day. Separate from study sessions. */
export const dailyPlans = sqliteTable(
	'daily_plans',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		planDate: text('plan_date').notNull(),
		startedSessionId: text('started_session_id').references(
			() => studySessions.id,
			{ onDelete: 'set null' }
		),
		createdAt: iso('created_at').notNull(),
		updatedAt: iso('updated_at').notNull()
	},
	(table) => [
		uniqueIndex('daily_plans_user_date_unique').on(
			table.userId,
			table.planDate
		),
		index('daily_plans_user_date_idx').on(table.userId, table.planDate),
		index('daily_plans_started_session_idx').on(table.startedSessionId)
	]
);

export const dailyPlanItems = sqliteTable(
	'daily_plan_items',
	{
		id: text('id').primaryKey(),
		planId: text('plan_id')
			.notNull()
			.references(() => dailyPlans.id, { onDelete: 'cascade' }),
		problemId: text('problem_id')
			.notNull()
			.references(() => problems.id, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		dueReason: text('due_reason').notNull(),
		source: text('source').notNull()
	},
	(table) => [
		uniqueIndex('daily_plan_items_position_unique').on(
			table.planId,
			table.position
		),
		uniqueIndex('daily_plan_items_problem_unique').on(
			table.planId,
			table.problemId
		),
		index('daily_plan_items_plan_idx').on(table.planId)
	]
);
