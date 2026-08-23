import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { transactions, recurringExpenses } from '@finanz/db/schema';
import type { db as DbType } from './index.js';

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentDay(): number {
  return new Date().getDate();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function processRecurringExpenses(db: typeof DbType) {
  const now = new Date();
  const currentPeriod = getCurrentPeriod();
  const currentDay = getCurrentDay();
  const [year, month] = currentPeriod.split('-').map(Number);
  const maxDay = daysInMonth(year, month);
  const effectiveDay = Math.min(currentDay, maxDay);

  console.log(`[recurring] Checking for period ${currentPeriod}, day ${currentDay} (effective ${effectiveDay})`);

  const items = await db.query.recurringExpenses.findMany({
    where: and(
      eq(recurringExpenses.active, true),
      lte(recurringExpenses.startPeriod, currentPeriod),
      sql`${recurringExpenses.endPeriod} IS NULL OR ${recurringExpenses.endPeriod} >= ${currentPeriod}`
    ),
  });

  console.log(`[recurring] Found ${items.length} active recurring items`);

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const targetDay = Math.min(item.dayOfMonth, maxDay);
    if (targetDay !== effectiveDay) {
      skipped++;
      continue;
    }

    // Check if already created for this period
    const existing = await db.query.transactions.findFirst({
      where: and(
        eq(transactions.recurringExpenseId, item.id),
        sql`to_char(${transactions.occurredOn}, 'YYYY-MM') = ${currentPeriod}`,
        eq(transactions.source, 'recurring')
      ),
    });

    if (existing) {
      skipped++;
      continue;
    }

    const occurredOn = new Date(year, month - 1, targetDay);

    const [tx] = await db
      .insert(transactions)
      .values({
        occurredOn,
        amountCents: item.amountCents,
        direction: item.direction,
        categoryId: item.categoryId,
        accountId: item.accountId,
        recurringExpenseId: item.id,
        merchant: item.name,
        note: 'Automatisch erstellt durch Dauerauftrag',
        source: 'recurring',
        confirmed: true,
      })
      .returning();

    console.log(`[recurring] Created transaction ${tx.id} for recurring expense ${item.id} (${item.name})`);
    created++;
  }

  console.log(`[recurring] Done: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}
