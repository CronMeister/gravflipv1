CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"target_value" integer NOT NULL,
	"reward_coins" integer NOT NULL,
	"icon" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_objectives" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "daily_objectives" CASCADE;--> statement-breakpoint
ALTER TABLE "user_objectives" DROP CONSTRAINT IF EXISTS "user_objectives_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_objectives" DROP CONSTRAINT IF EXISTS "user_objectives_objective_id_daily_objectives_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_objectives_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_user_objectives_user_date";--> statement-breakpoint
ALTER TABLE "user_objectives" ADD COLUMN IF NOT EXISTS "device_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "user_objectives" ADD CONSTRAINT "user_objectives_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_objectives_device_date" ON "user_objectives" USING btree ("device_id","date");--> statement-breakpoint
ALTER TABLE "user_objectives" DROP COLUMN IF EXISTS "user_id";