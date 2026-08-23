import { db } from '@/lib/db';
import { workTimeEntries } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { WorkTimeForm } from '@/components/work-time-form';

interface EditWorkTimePageProps {
  params: { id: string };
}

export default async function EditWorkTimePage({ params }: EditWorkTimePageProps) {
  const { id } = params;

  const entry = await db.query.workTimeEntries.findFirst({
    where: eq(workTimeEntries.id, parseInt(id)),
  });

  if (!entry) {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto">
      <WorkTimeForm initialData={entry} isEdit />
    </div>
  );
}
