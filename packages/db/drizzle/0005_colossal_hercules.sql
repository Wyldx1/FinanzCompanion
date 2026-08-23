ALTER TABLE "transactions" ADD COLUMN "recurring_expense_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
