import { db } from '@/lib/db';
import { categories, accounts } from '@finanz/db/schema';
import { isNull, asc } from 'drizzle-orm';
import { TransactionForm } from '@/components/transaction-form';

export default async function NewTransactionPage() {
  const [allCategories, allAccounts] = await Promise.all([
    db.query.categories.findMany({
      where: isNull(categories.archivedAt),
      orderBy: [asc(categories.sortOrder)],
    }),
    db.query.accounts.findMany({
      where: isNull(accounts.archivedAt),
      orderBy: [asc(accounts.sortOrder)],
    }),
  ]);

  return (
    <div className="max-w-lg mx-auto">
      <TransactionForm categories={allCategories} accounts={allAccounts} />
    </div>
  );
}
