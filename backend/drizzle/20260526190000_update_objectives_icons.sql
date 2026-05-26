UPDATE objectives SET icon = 'flash-on' WHERE kind = 'score_in_run';
--> statement-breakpoint
UPDATE objectives SET icon = 'trending-up' WHERE kind = 'score_total_today';
--> statement-breakpoint
UPDATE objectives SET icon = 'replay' WHERE kind = 'runs_today';
