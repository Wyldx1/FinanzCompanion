import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { transactions, categories, accounts } from '@finanz/db/schema';
import { desc, isNull, and, gte, eq } from 'drizzle-orm';
import { formatCurrency, getCurrentPeriod } from '@/lib/utils';
import { Plus, Receipt, TrendingDown, TrendingUp, X } from 'lucide-react';
import Link from 'next/link';
import { TransactionList } from '@/components/transaction-list';

interface TransactionsPageProps {
  searchParams: { account?: string };
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const currentPeriod = getCurrentPeriod();
  const monthStart = new Date(currentPeriod + '-01');
  const accountFilter = searchParams.account ? parseInt(searchParams.account) : null;

  const whereClause = accountFilter
    ? and(eq(transactions.accountId, accountFilter))
    : undefined;

  const allTransactions = await db.query.transactions.findMany({
    where: whereClause,
    with: { category: true, account: true, targetAccount: true },
    orderBy: [desc(transactions.occurredOn), desc(transactions.createdAt)],
    limit: 200,
  });

  const filteredAccount = accountFilter
    ? await db.query.accounts.findFirst({ where: eq(accounts.id, accountFilter) })
    : null;

  // Calculate monthly totals
  const monthlyTransactions = allTransactions.filter(
    tx => new Date(tx.occurredOn) >= monthStart
  );

  const monthlyExpenses = monthlyTransactions
    .filter(tx => tx.direction === 'expense')
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  const monthlyIncome = monthlyTransactions
    .filter(tx => tx.direction === 'income')
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  const unconfirmedCount = allTransactions.filter(tx => !tx.confirmed).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">
            {filteredAccount ? `Transaktionen: ${filteredAccount.name}` : 'Transaktionen'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {allTransactions.length} Transaktionen
            {unconfirmedCount > 0 && (
              <span className="text-[hsl(45,90%,70%)]"> · {unconfirmedCount} unbestätigt</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filteredAccount && (
            <Link href="/transactions">
              <Button variant="outline" size="sm">
                <X className="mr-2 h-4 w-4" />
                Filter löschen
              </Button>
            </Link>
          )}
          <Link href="/transactions/new">
            <Button className="glow hover-lift">
              <Plus className="mr-2 h-4 w-4" />
              Neue Transaktion
            </Button>
          </Link>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ausgaben diesen Monat</p>
                <p className="text-2xl font-bold text-[hsl(330,80%,75%)] mt-1">
                  -{formatCurrency(monthlyExpenses)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[hsl(330,80%,75%)]/10 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-[hsl(330,80%,75%)]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass hover-lift overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Einnahmen diesen Monat</p>
                <p className="text-2xl font-bold text-[hsl(172,66%,65%)] mt-1">
                  +{formatCurrency(monthlyIncome)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-[hsl(172,66%,65%)]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {filteredAccount ? `Transaktionen für ${filteredAccount.name}` : 'Alle Transaktionen'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionList transactions={allTransactions} />
        </CardContent>
      </Card>
    </div>
  );
}
