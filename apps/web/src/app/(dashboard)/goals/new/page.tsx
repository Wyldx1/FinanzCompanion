import { db } from '@/lib/db';
import { accounts } from '@finanz/db/schema';
import { isNull, asc } from 'drizzle-orm';
import { GoalForm } from '@/components/goal-form';

export default async function NewGoalPage() {
  const allAccounts = await db.query.accounts.findMany({
    where: isNull(accounts.archivedAt),
    orderBy: [asc(accounts.sortOrder)],
  });

  return (
    <div className="max-w-lg mx-auto">
      <GoalForm accounts={allAccounts} />
    </div>
  );
}
