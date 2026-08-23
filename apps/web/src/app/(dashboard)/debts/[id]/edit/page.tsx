import { db } from '@/lib/db';
import { debts } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { DebtForm } from '@/components/debt-form';

interface EditDebtPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDebtPage({ params }: EditDebtPageProps) {
  const { id } = await params;

  const debt = await db.query.debts.findFirst({
    where: eq(debts.id, parseInt(id)),
  });

  if (!debt) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto">
      <DebtForm
        initialData={{
          id: debt.id,
          creditor: debt.creditor,
          originalCents: debt.originalCents,
          interestRateBps: debt.interestRateBps,
          minimumPaymentCents: debt.minimumPaymentCents,
          dueDay: debt.dueDay,
          targetPayoffDate: debt.targetPayoffDate,
        }}
        isEdit
      />
    </div>
  );
}
