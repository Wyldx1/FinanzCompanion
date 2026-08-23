import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { recurringExpenses } from '@finanz/db/schema';
import { desc } from 'drizzle-orm';
import { Plus, Repeat } from 'lucide-react';
import Link from 'next/link';
import { RecurringExpenseList } from '@/components/recurring-expense-list';

export default async function RecurringExpensesPage() {
  const items = await db.query.recurringExpenses.findMany({
    with: { category: true, account: true },
    orderBy: [desc(recurringExpenses.createdAt)],
  });

  const activeCount = items.filter((i) => i.active).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Daueraufträge</h1>
          <p className="text-muted-foreground mt-1">
            {activeCount} aktiv · {items.length - activeCount} pausiert
          </p>
        </div>
        <Link href="/recurring-expenses/new">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neuer Dauerauftrag
          </Button>
        </Link>
      </div>

      {/* Recurring Expenses List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            Alle Daueraufträge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecurringExpenseList items={items} />
        </CardContent>
      </Card>
    </div>
  );
}
