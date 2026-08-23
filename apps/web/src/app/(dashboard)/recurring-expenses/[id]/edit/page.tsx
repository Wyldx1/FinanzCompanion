import { db } from '@/lib/db';
import { recurringExpenses, categories, accounts } from '@finanz/db/schema';
import { eq, isNull, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { RecurringExpenseForm } from '@/components/recurring-expense-form';

interface EditRecurringExpensePageProps {
  params: { id: string };
}

export default async function EditRecurringExpensePage({ params }: EditRecurringExpensePageProps) {
  const { id } = params;

  const [item, allCategories, activeAccounts] = await Promise.all([
    db.query.recurringExpenses.findFirst({
      where: eq(recurringExpenses.id, parseInt(id)),
    }),
    db.query.categories.findMany({
      orderBy: [asc(categories.sortOrder)],
    }),
    db.query.accounts.findMany({
      where: isNull(accounts.archivedAt),
      orderBy: [asc(accounts.sortOrder)],
    }),
  ]);

  if (!item) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto">
      <RecurringExpenseForm
        categories={allCategories}
        accounts={activeAccounts}
        initialData={item}
        isEdit
      />
    </div>
  );
}
