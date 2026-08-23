import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { weightEntries } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { WeightForm } from '@/components/weight-form';

interface EditWeightPageProps {
  params: { id: string };
}

export default async function EditWeightPage({ params }: EditWeightPageProps) {
  const id = parseInt(params.id);
  if (isNaN(id)) notFound();

  const entry = await db.query.weightEntries.findFirst({
    where: eq(weightEntries.id, id),
  });

  if (!entry) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <WeightForm initialData={entry} isEdit />
    </div>
  );
}
