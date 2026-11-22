CREATE TABLE `external_solve_links` (
	`id` text PRIMARY KEY NOT NULL,
	`external_solve_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`method` text NOT NULL,
	`confidence` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`external_solve_id`) REFERENCES `external_solves`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `external_solve_links_external_unique` ON `external_solve_links` (`external_solve_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `external_solve_links_pair_unique` ON `external_solve_links` (`external_solve_id`,`attempt_id`);--> statement-breakpoint
CREATE INDEX `external_solve_links_attempt_idx` ON `external_solve_links` (`attempt_id`);--> statement-breakpoint
INSERT INTO `external_solve_links` (
	`id`,
	`external_solve_id`,
	`attempt_id`,
	`method`,
	`confidence`,
	`created_at`
)
SELECT
	lower(hex(randomblob(16))),
	external_solve.id,
	attempt.id,
	'time_window',
	'high',
	strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `external_solves` AS external_solve
INNER JOIN `attempts` AS attempt
	ON attempt.user_id = external_solve.user_id
	AND attempt.problem_id = external_solve.problem_id
WHERE EXISTS (
	SELECT 1
	FROM `timer_segments` AS segment
	WHERE segment.attempt_id = attempt.id
		AND (
			(
				segment.ended_at IS NOT NULL
				AND julianday(external_solve.submitted_at) >= julianday(segment.started_at)
				AND julianday(external_solve.submitted_at) <= julianday(segment.ended_at)
			)
			OR (
				segment.ended_at IS NOT NULL
				AND julianday(external_solve.submitted_at) > julianday(segment.ended_at)
				AND julianday(external_solve.submitted_at) <= julianday(segment.ended_at, '+10 minutes')
				AND NOT EXISTS (
					SELECT 1
					FROM `timer_segments` AS later_segment
					WHERE later_segment.attempt_id = segment.attempt_id
						AND julianday(later_segment.started_at) > julianday(segment.started_at)
				)
			)
		)
)
AND NOT EXISTS (
	SELECT 1
	FROM `attempts` AS other_attempt
	WHERE other_attempt.user_id = external_solve.user_id
		AND other_attempt.problem_id = external_solve.problem_id
		AND other_attempt.id <> attempt.id
		AND EXISTS (
			SELECT 1
			FROM `timer_segments` AS other_segment
			WHERE other_segment.attempt_id = other_attempt.id
				AND (
					(
						other_segment.ended_at IS NOT NULL
						AND julianday(external_solve.submitted_at) >= julianday(other_segment.started_at)
						AND julianday(external_solve.submitted_at) <= julianday(other_segment.ended_at)
					)
					OR (
						other_segment.ended_at IS NOT NULL
						AND julianday(external_solve.submitted_at) > julianday(other_segment.ended_at)
						AND julianday(external_solve.submitted_at) <= julianday(other_segment.ended_at, '+10 minutes')
						AND NOT EXISTS (
							SELECT 1
							FROM `timer_segments` AS later_other_segment
							WHERE later_other_segment.attempt_id = other_segment.attempt_id
								AND julianday(later_other_segment.started_at) > julianday(other_segment.started_at)
						)
					)
				)
		)
)
AND NOT EXISTS (
	SELECT 1
	FROM `external_solve_links` AS existing_link
	WHERE existing_link.external_solve_id = external_solve.id
);
