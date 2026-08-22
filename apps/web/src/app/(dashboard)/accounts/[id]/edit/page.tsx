import { db } from '@/lib/db';
import { accounts } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { AccountForm } from '@/components/account-form';

interface EditAccountPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAccountPage({ params }: EditAccountPageProps) {
  const { id } = await params;

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, parseInt(id)),
  });

  if (!account) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto">
      <AccountForm initialData={account} isEdit />
    </div>
  );
}
