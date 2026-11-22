CREATE TABLE `external_solves` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`repository` text NOT NULL,
	`submission_path` text NOT NULL,
	`submission_index` integer NOT NULL,
	`language` text NOT NULL,
	`commit_sha` text NOT NULL,
	`submitted_at` text NOT NULL,
	`source_code_url` text NOT NULL,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_solves_repository_path_unique` ON `external_solves` (`repository`,`submission_path`);--> statement-breakpoint
CREATE INDEX `external_solves_user_submitted_idx` ON `external_solves` (`user_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `external_solves_user_problem_idx` ON `external_solves` (`user_id`,`problem_id`);--> statement-breakpoint
ALTER TABLE `problems` ADD `provider` text DEFAULT 'leetcode' NOT NULL;