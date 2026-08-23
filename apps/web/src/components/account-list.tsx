'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Archive, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
  id: number;
  name: string;
  kind: string;
  icon: string | null;
  institution: string | null;
  includeInNetworth: boolean;
  isDefaultPayment: boolean;
}

const kindLabels: Record<string, string> = {
  checking: 'Girokonto',
  cash: 'Bargeld',
  savings: 'Tagesgeld',
  investment: 'Depot',
  receivable: 'Forderung',
  liability: 'Schulden',
};

const kindColors: Record<string, string> = {
  checking: 'bg-[hsl(210,80%,70%)]/10 text-[hsl(210,80%,70%)]',
  cash: 'bg-[hsl(45,90%,70%)]/10 text-[hsl(45,90%,70%)]',
  savings: 'bg-[hsl(172,66%,65%)]/10 text-[hsl(172,66%,65%)]',
  investment: 'bg-[hsl(262,83%,75%)]/10 text-[hsl(262,83%,75%)]',
  receivable: 'bg-[hsl(25,90%,70%)]/10 text-[hsl(25,90%,70%)]',
  liability: 'bg-[hsl(330,80%,75%)]/10 text-[hsl(330,80%,75%)]',
};

interface AccountListProps {
  accounts: Account[];
  isArchived?: boolean;
}

export function AccountList({ accounts, isArchived = false }: AccountListProps) {
  const router = useRouter();

  async function handleArchive(id: number) {
    if (!confirm('Konto wirklich archivieren?')) return;

    await fetch(`/api/accounts/${id}`, {
      method: 'DELETE',
    });

    router.refresh();
  }

  async function handleDirectDelete(id: number) {
    if (!confirm('Konto endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;

    const res = await fetch(`/api/accounts/${id}?hard=true`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: { message: 'Unbekannter Fehler' } }));
      alert(data.error?.message || 'Löschen fehlgeschlagen. Das Konto hat möglicherweise noch Daten.');
      return;
    }

    router.refresh();
  }

  async function handleRestore(id: number) {
    await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archivedAt: null }),
    });

    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm('Konto endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;

    await fetch(`/api/accounts/${id}?hard=true`, {
      method: 'DELETE',
    });

    router.refresh();
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🏦</span>
        </div>
        <p className="text-muted-foreground">
          {isArchived ? 'Keine archivierten Konten' : 'Noch keine Konten angelegt'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account, index) => (
        <div
          key={account.id}
          className={cn(
            'flex items-center justify-between p-4 rounded-xl transition-all duration-300 slide-in',
            isArchived ? 'bg-secondary/30' : 'bg-secondary/50 hover:bg-secondary/80'
          )}
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
              {account.icon || '💰'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{account.name}</p>
                {account.isDefaultPayment && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    Standard
                  </span>
                )}
                {!account.includeInNetworth && (
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    Nicht in Vermögen
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  kindColors[account.kind] || 'bg-secondary text-muted-foreground'
                )}>
                  {kindLabels[account.kind] || account.kind}
                </span>
                {account.institution && (
                  <span className="text-xs text-muted-foreground">
                    {account.institution}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isArchived ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRestore(account.id)}
                  className="hover:bg-[hsl(172,66%,65%)]/20 hover:text-[hsl(172,66%,65%)]"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(account.id)}
                  className="hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/accounts/${account.id}/edit`)}
                  className="hover:bg-primary/20 hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleArchive(account.id)}
                  className="hover:bg-[hsl(45,90%,70%)]/20 hover:text-[hsl(45,90%,70%)]"
                >
                  <Archive className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDirectDelete(account.id)}
                  className="hover:bg-destructive/20 hover:text-destructive"
                  title="Endgültig löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
