CREATE TABLE "daily_reward_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"day_number" integer NOT NULL,
	"reward_type" text NOT NULL,
	"reward_value" integer,
	"reward_item_id" uuid,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_streak" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"last_claimed_date" date,
	"total_claimed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_equipped" (
	"user_id" text NOT NULL,
	"slot" text NOT NULL,
	"item_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "rarity" text DEFAULT 'common' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "currency_type" text DEFAULT 'flux' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "tab" text DEFAULT 'skins' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "iap_product_id" text;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "price_display" text;--> statement-breakpoint
ALTER TABLE "store_items" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_reward_claims" ADD CONSTRAINT "daily_reward_claims_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reward_claims" ADD CONSTRAINT "daily_reward_claims_reward_item_id_store_items_id_fk" FOREIGN KEY ("reward_item_id") REFERENCES "public"."store_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_streak" ADD CONSTRAINT "daily_streak_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_equipped" ADD CONSTRAINT "user_equipped_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_equipped" ADD CONSTRAINT "user_equipped_item_id_store_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."store_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_reward_claims_user_id" ON "daily_reward_claims" USING btree ("user_id");