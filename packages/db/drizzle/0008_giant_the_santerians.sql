CREATE TABLE IF NOT EXISTS "weight_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_weight_date" ON "weight_entries" USING btree ("date");