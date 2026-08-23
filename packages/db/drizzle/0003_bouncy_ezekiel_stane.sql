ALTER TABLE "debts" ALTER COLUMN "original_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "debts" ALTER COLUMN "original_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "debts" ALTER COLUMN "minimum_payment_cents" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "debts" ALTER COLUMN "minimum_payment_cents" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;