CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `attempt_mistakes` (
	`attempt_id` text NOT NULL,
	`mistake_id` text NOT NULL,
	`occurrence_note` text,
	PRIMARY KEY(`attempt_id`, `mistake_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempt_mistakes_mistake_idx` ON `attempt_mistakes` (`mistake_id`);--> statement-breakpoint
CREATE TABLE `attempt_patterns` (
	`attempt_id` text NOT NULL,
	`pattern_id` text NOT NULL,
	`trigger_note` text,
	PRIMARY KEY(`attempt_id`, `pattern_id`),
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`pattern_id`) REFERENCES `patterns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempt_patterns_pattern_idx` ON `attempt_patterns` (`pattern_id`);--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`outcome` text,
	`confidence` integer,
	`notes` text,
	`redo_date` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_session_problem_unique` ON `attempts` (`session_id`,`problem_id`);--> statement-breakpoint
CREATE INDEX `attempts_user_problem_completed_idx` ON `attempts` (`user_id`,`problem_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `attempts_user_redo_idx` ON `attempts` (`user_id`,`redo_date`);--> statement-breakpoint
CREATE INDEX `attempts_user_completed_idx` ON `attempts` (`user_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `briefing_mistakes` (
	`briefing_id` text NOT NULL,
	`mistake_id` text NOT NULL,
	`rank` integer NOT NULL,
	`score` integer NOT NULL,
	`occurrence_count` integer NOT NULL,
	`last_occurrence` text NOT NULL,
	`average_confidence` integer NOT NULL,
	PRIMARY KEY(`briefing_id`, `mistake_id`),
	FOREIGN KEY (`briefing_id`) REFERENCES `briefings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mistake_id`) REFERENCES `mistakes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `briefing_mistakes_rank_unique` ON `briefing_mistakes` (`briefing_id`,`rank`);--> statement-breakpoint
CREATE TABLE `briefing_redos` (
	`briefing_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`due_date` text NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`briefing_id`, `problem_id`),
	FOREIGN KEY (`briefing_id`) REFERENCES `briefings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `briefing_redos_rank_unique` ON `briefing_redos` (`briefing_id`,`rank`);--> statement-breakpoint
CREATE TABLE `briefings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`created_at` text NOT NULL,
	`acknowledged_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `briefings_session_unique` ON `briefings` (`session_id`);--> statement-breakpoint
CREATE INDEX `briefings_user_created_idx` ON `briefings` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `mistakes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`description` text,
	`guardrail` text,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mistakes_user_normalized_unique` ON `mistakes` (`user_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `mistakes_user_archived_idx` ON `mistakes` (`user_id`,`archived`);--> statement-breakpoint
CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`recognition_trigger` text,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patterns_user_normalized_unique` ON `patterns` (`user_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `patterns_user_archived_idx` ON `patterns` (`user_id`,`archived`);--> statement-breakpoint
CREATE TABLE `problem_topics` (
	`problem_id` text NOT NULL,
	`topic_id` text NOT NULL,
	PRIMARY KEY(`problem_id`, `topic_id`),
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `problem_topics_topic_idx` ON `problem_topics` (`topic_id`);--> statement-breakpoint
CREATE TABLE `problems` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`difficulty` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `problems_user_url_unique` ON `problems` (`user_id`,`url`);--> statement-breakpoint
CREATE INDEX `problems_user_slug_idx` ON `problems` (`user_id`,`slug`);--> statement-breakpoint
CREATE INDEX `problems_user_created_idx` ON `problems` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `session_queue` (
	`session_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`session_id`, `problem_id`),
	FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_queue_position_unique` ON `session_queue` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_sessions_user_started_idx` ON `study_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `study_sessions_user_status_idx` ON `study_sessions` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `timer_segments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`attempt_id` text,
	`started_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `timer_segments_session_idx` ON `timer_segments` (`session_id`);--> statement-breakpoint
CREATE INDEX `timer_segments_attempt_idx` ON `timer_segments` (`attempt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `timer_segments_one_open_per_session` ON `timer_segments` (`session_id`) WHERE ended_at is null;--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `topics_user_normalized_unique` ON `topics` (`user_id`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verifications_identifier_idx` ON `verifications` (`identifier`);