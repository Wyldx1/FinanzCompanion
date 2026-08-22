DO $$ BEGIN
 CREATE TYPE "public"."account_kind" AS ENUM('checking', 'cash', 'savings', 'investment', 'receivable', 'liability');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."advice_trigger" AS ENUM('monthly', 'on_demand', 'alert');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."goal_kind" AS ENUM('emergency_fund', 'purchase', 'debt_payoff', 'retirement', 'custom');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."snapshot_status" AS ENUM('draft', 'complete', 'missed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tx_direction" AS ENUM('expense', 'income', 'transfer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."tx_source" AS ENUM('telegram', 'web', 'csv_import', 'psd2');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "account_kind" NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"institution" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"include_in_networth" boolean DEFAULT true NOT NULL,
	"is_default_payment" boolean DEFAULT false NOT NULL,
	"succeeded_by_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advice_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" char(7) NOT NULL,
	"trigger" "advice_trigger" NOT NULL,
	"model" text NOT NULL,
	"metrics_json" jsonb NOT NULL,
	"verdict" text NOT NULL,
	"body" text NOT NULL,
	"commitments" jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_sessions" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"is_essential" boolean DEFAULT false NOT NULL,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "commitment_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"advice_id" integer NOT NULL,
	"commitment_id" text NOT NULL,
	"evaluated_period" char(7) NOT NULL,
	"target_cents" bigint,
	"actual_cents" bigint,
	"met" boolean,
	CONSTRAINT "commitment_results_advice_id_commitment_id_evaluated_period_unique" UNIQUE("advice_id","commitment_id","evaluated_period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "debts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"creditor" text NOT NULL,
	"original_cents" bigint,
	"interest_rate_bps" integer DEFAULT 0 NOT NULL,
	"minimum_payment_cents" bigint,
	"due_day" smallint,
	"target_payoff_date" timestamp,
	CONSTRAINT "debts_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goal_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"period" char(7) NOT NULL,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "goal_contributions_goal_id_period_unique" UNIQUE("goal_id","period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "goal_kind" NOT NULL,
	"target_cents" bigint NOT NULL,
	"target_date" timestamp,
	"priority" smallint DEFAULT 5 NOT NULL,
	"linked_account_id" integer,
	"monthly_plan_cents" bigint,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"achieved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "module_settings" (
	"module_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quick_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"keyword" text NOT NULL,
	"label" text NOT NULL,
	"category_id" integer,
	"account_id" integer,
	"direction" "tx_direction" DEFAULT 'expense' NOT NULL,
	"default_amount_cents" bigint,
	"merchant" text,
	"show_on_keyboard" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "quick_actions_keyword_unique" UNIQUE("keyword")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" char(7) NOT NULL,
	"stage" smallint NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" text DEFAULT 'telegram' NOT NULL,
	CONSTRAINT "reminders_period_stage_unique" UNIQUE("period","stage")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "snapshot_balances" (
	"snapshot_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"balance_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"period" char(7) NOT NULL,
	"status" "snapshot_status" DEFAULT 'draft' NOT NULL,
	"recorded_at" timestamp with time zone,
	"income_cents" bigint DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshots_period_unique" UNIQUE("period")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"occurred_on" timestamp NOT NULL,
	"amount_cents" bigint NOT NULL,
	"direction" "tx_direction" NOT NULL,
	"category_id" integer,
	"account_id" integer,
	"merchant" text,
	"note" text,
	"source" "tx_source" NOT NULL,
	"raw_input" text,
	"confidence" real,
	"confirmed" boolean DEFAULT false NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"passphrase_hash" text NOT NULL,
	"totp_secret" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "commitment_results" ADD CONSTRAINT "commitment_results_advice_id_advice_log_id_fk" FOREIGN KEY ("advice_id") REFERENCES "public"."advice_log"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "debts" ADD CONSTRAINT "debts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "goals" ADD CONSTRAINT "goals_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quick_actions" ADD CONSTRAINT "quick_actions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quick_actions" ADD CONSTRAINT "quick_actions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshot_balances" ADD CONSTRAINT "snapshot_balances_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "snapshot_balances" ADD CONSTRAINT "snapshot_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accounts_active" ON "accounts" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_period" ON "transactions" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tx_category" ON "transactions" USING btree ("category_id","occurred_on");