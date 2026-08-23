import { db } from '@/lib/db';
import { categories, accounts } from '@finanz/db/schema';
import { isNull, asc } from 'drizzle-orm';
import { TransactionForm } from '@/components/transaction-form';

interface NewTransactionPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function NewTransactionPage({ searchParams }: NewTransactionPageProps) {
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

  const accountIdParam = searchParams.accountId;
  const directionParam = searchParams.direction;
  const noteParam = searchParams.note;

  const defaultValues: {
    direction?: 'expense' | 'income' | 'transfer';
    accountId?: number | null;
    note?: string | null;
  } = {
    accountId: typeof accountIdParam === 'string' ? parseInt(accountIdParam, 10) || null : null,
    direction: directionParam === 'expense' || directionParam === 'income' || directionParam === 'transfer'
      ? directionParam
      : undefined,
    note: typeof noteParam === 'string' ? noteParam : null,
  };

  return (
    <div className="max-w-lg mx-auto">
      <TransactionForm categories={allCategories} accounts={allAccounts} defaultValues={defaultValues} />
    </div>
  );
}
