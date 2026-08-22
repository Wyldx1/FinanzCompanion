import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { accounts } from '@finanz/db/schema';
import { isNull, asc, isNotNull } from 'drizzle-orm';
import { Plus, Building2, Archive } from 'lucide-react';
import Link from 'next/link';
import { AccountList } from '@/components/account-list';

export default async function AccountsPage() {
  const activeAccounts = await db.query.accounts.findMany({
    where: isNull(accounts.archivedAt),
    orderBy: [asc(accounts.sortOrder)],
  });

  const archivedAccounts = await db.query.accounts.findMany({
    where: isNotNull(accounts.archivedAt),
    orderBy: [asc(accounts.sortOrder)],
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gradient-text">Konten</h1>
          <p className="text-muted-foreground mt-1">
            {activeAccounts.length} aktive Konten
          </p>
        </div>
        <Link href="/accounts/new">
          <Button className="glow hover-lift">
            <Plus className="mr-2 h-4 w-4" />
            Neues Konto
          </Button>
        </Link>
      </div>

      {/* Active Accounts */}
      <Card className="glass hover-lift overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Aktive Konten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccountList accounts={activeAccounts} />
        </CardContent>
      </Card>

      {/* Archived Accounts */}
      {archivedAccounts.length > 0 && (
        <Card className="glass opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Archive className="h-5 w-5" />
              Archivierte Konten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AccountList accounts={archivedAccounts} isArchived />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
