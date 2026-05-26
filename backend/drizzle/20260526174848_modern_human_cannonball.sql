ALTER TABLE "objectives" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "user_objectives" ADD COLUMN "date_utc" text;--> statement-breakpoint
CREATE INDEX "idx_objectives_code" ON "objectives" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_user_objectives_device_date_utc" ON "user_objectives" USING btree ("device_id","date_utc");