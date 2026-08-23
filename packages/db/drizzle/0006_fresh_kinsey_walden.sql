CREATE TABLE IF NOT EXISTS "work_time_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"start_time" time DEFAULT '07:30:00' NOT NULL,
	"end_time" time NOT NULL,
	"break_minutes" integer DEFAULT 0 NOT NULL,
	"site" text,
	"notes" text,
	"net_minutes" integer NOT NULL,
	"target_minutes" integer NOT NULL,
	"overtime_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_work_time_date" ON "work_time_entries" USING btree ("date");