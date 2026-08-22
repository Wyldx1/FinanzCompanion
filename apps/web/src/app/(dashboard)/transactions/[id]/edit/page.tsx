import { db } from '@/lib/db';
import { transactions, categories, accounts } from '@finanz/db/schema';
import { eq, isNull, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { TransactionForm } from '@/components/transaction-form';

interface EditTransactionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTransactionPage({ params }: EditTransactionPageProps) {
  const { id } = await params;

  const [tx, allCategories, allAccounts] = await Promise.all([
    db.query.transactions.findFirst({
      where: eq(transactions.id, parseInt(id)),
    }),
    db.query.categories.findMany({
      where: isNull(categories.archivedAt),
      orderBy: [asc(categories.sortOrder)],
    }),
    db.query.accounts.findMany({
      where: isNull(accounts.archivedAt),
      orderBy: [asc(accounts.sortOrder)],
    }),
  ]);

  if (!tx) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto">
      <TransactionForm
        categories={allCategories}
        accounts={allAccounts}
        initialData={{
          id: tx.id,
          occurredOn: tx.occurredOn,
          amountCents: tx.amountCents,
          direction: tx.direction,
          categoryId: tx.categoryId,
          accountId: tx.accountId,
          merchant: tx.merchant,
          note: tx.note,
        }}
        isEdit
      />
    </div>
  );
}
