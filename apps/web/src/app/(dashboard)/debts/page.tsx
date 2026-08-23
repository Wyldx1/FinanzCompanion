import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { debts, snapshots, snapshotBalances } from '@finanz/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { formatCurrency } from '@/lib/utils';
import { Plus, CreditCard, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { DebtList } from '@/components/debt-list';

export default async function DebtsPage() {
  const allDebts = await db.query.debts.findMany({
    with: { account: true },
    orderBy: [desc(debts.createdAt)],
  });

  // Get latest completed snapshot balances for liability accounts
  const latestSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.status, 'complete'),
    orderBy: [desc(snapshots.period)],
    with: {
      balances: {
        with: { account: true },
      },
    },
  });

  const balanceByAccount = new Map<number, number>();
  if (latestSnapshot) {
    for (const b of latestSnapshot.balances) {
      balanceByAccount.set(b.accountId, b.balanceCents);
    }
  }

  const enrichedDebts = allDebts.map((debt) => ({
    ...debt,
    currentBalanceCents: balanceByAccount.get(debt.accountId) ?? debt.originalCents,
  }));

  const totalDebt = enrichedDebts.reduce((sum, d) => sum + d.currentBalanceCents, 0);
  const totalOriginal = enrichedDebts.reduce((sum, d) => sum + d.originalCents, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Schulden</h1>
          <p className="text-muted-foreground mt-1">
            {allDebts.length} Schuld{allDebts.length !== 1 && 'en'}
          </p>
        </div>
        <Link href="/debts/new">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neue Schuld
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      {allDebts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Aktuelle Gesamtschuld</p>
                  <p className="text-2xl font-bold text-[hsl(330,80%,75%)] mt-1">
                    {formatCurrency(totalDebt)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(330,80%,75%)]/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-[hsl(330,80%,75%)]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass hover-lift overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bereits getilgt</p>
                  <p className="text-2xl font-bold text-[hsl(172,66%,65%)] mt-1">
                    {formatCurrency(Math.max(0, totalOriginal - totalDebt))}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-[hsl(172,66%,65%)]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Debts List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Alle Schulden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DebtList debts={enrichedDebts} />
        </CardContent>
      </Card>
    </div>
  );
}
