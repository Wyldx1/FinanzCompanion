ALTER TYPE "tx_source" ADD VALUE 'recurring';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurring_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"direction" "tx_direction" DEFAULT 'expense' NOT NULL,
	"category_id" integer,
	"account_id" integer,
	"start_period" char(7) NOT NULL,
	"end_period" char(7),
	"day_of_month" smallint DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
