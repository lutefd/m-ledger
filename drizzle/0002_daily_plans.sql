CREATE TABLE `daily_plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`position` integer NOT NULL,
	`due_reason` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `daily_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_plan_items_position_unique` ON `daily_plan_items` (`plan_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_plan_items_problem_unique` ON `daily_plan_items` (`plan_id`,`problem_id`);--> statement-breakpoint
CREATE INDEX `daily_plan_items_plan_idx` ON `daily_plan_items` (`plan_id`);--> statement-breakpoint
CREATE TABLE `daily_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_date` text NOT NULL,
	`started_session_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`started_session_id`) REFERENCES `study_sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_plans_user_date_unique` ON `daily_plans` (`user_id`,`plan_date`);--> statement-breakpoint
CREATE INDEX `daily_plans_user_date_idx` ON `daily_plans` (`user_id`,`plan_date`);--> statement-breakpoint
CREATE INDEX `daily_plans_started_session_idx` ON `daily_plans` (`started_session_id`);