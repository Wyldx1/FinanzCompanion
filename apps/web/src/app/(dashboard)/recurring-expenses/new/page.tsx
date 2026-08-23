import { RecurringExpenseForm } from '@/components/recurring-expense-form';
import { db } from '@/lib/db';
import { categories, accounts } from '@finanz/db/schema';
import { isNull, asc } from 'drizzle-orm';

export default async function NewRecurringExpensePage() {
  const [allCategories, activeAccounts] = await Promise.all([
    db.query.categories.findMany({
      orderBy: [asc(categories.sortOrder)],
    }),
    db.query.accounts.findMany({
      where: isNull(accounts.archivedAt),
      orderBy: [asc(accounts.sortOrder)],
    }),
  ]);

  return (
    <div className="max-w-lg mx-auto">
      <RecurringExpenseForm categories={allCategories} accounts={activeAccounts} />
    </div>
  );
}
