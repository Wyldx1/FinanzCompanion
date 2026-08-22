import { db } from '@/lib/db';
import { goals, accounts } from '@finanz/db/schema';
import { eq, isNull, asc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { GoalForm } from '@/components/goal-form';

interface EditGoalPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditGoalPage({ params }: EditGoalPageProps) {
  const { id } = await params;

  const [goal, allAccounts] = await Promise.all([
    db.query.goals.findFirst({
      where: eq(goals.id, parseInt(id)),
    }),
    db.query.accounts.findMany({
      where: isNull(accounts.archivedAt),
      orderBy: [asc(accounts.sortOrder)],
    }),
  ]);

  if (!goal) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto">
      <GoalForm
        accounts={allAccounts}
        initialData={{
          id: goal.id,
          name: goal.name,
          kind: goal.kind,
          targetCents: goal.targetCents,
          targetDate: goal.targetDate,
          priority: goal.priority,
          linkedAccountId: goal.linkedAccountId,
          monthlyPlanCents: goal.monthlyPlanCents,
        }}
        isEdit
      />
    </div>
  );
}
