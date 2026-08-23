'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FeedbackToast, useFeedback } from '@/components/feedback-toast';
import { Pencil, Trash2, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface Transaction {
  id: number;
  occurredOn: Date;
  amountCents: number;
  direction: 'expense' | 'income' | 'transfer';
  merchant: string | null;
  note: string | null;
  confirmed: boolean;
  category: {
    id: number;
    name: string;
    icon: string | null;
  } | null;
  account: {
    id: number;
    name: string;
    icon: string | null;
  } | null;
  targetAccount: {
    id: number;
    name: string;
    icon: string | null;
  } | null;
}

interface TransactionListProps {
  transactions: Transaction[];
}

const directionColors = {
  expense: 'text-[hsl(330,80%,75%)]',
  income: 'text-[hsl(172,66%,65%)]',
  transfer: 'text-[hsl(210,80%,70%)]',
};

export function TransactionList({ transactions }: TransactionListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { feedback, showFeedback } = useFeedback();

  async function handleDelete(id: number) {
    setDeleteId(null);

    const res = await fetch(`/api/transactions/${id}`, {
      method: 'DELETE',
    });

    showFeedback(
      res.ok
        ? { text: 'Transaktion gelöscht', kind: 'success' }
        : { text: 'Löschen fehlgeschlagen', kind: 'error' }
    );

    router.refresh();
  }

  async function handleConfirm(id: number) {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed: true }),
    });

    showFeedback(
      res.ok
        ? { text: 'Transaktion bestätigt', kind: 'success' }
        : { text: 'Bestätigen fehlgeschlagen', kind: 'error' }
    );

    router.refresh();
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">📝</span>
        </div>
        <p className="text-lg text-foreground mb-2">Keine Transaktionen</p>
        <p className="text-muted-foreground text-sm">
          Erfasse Ausgaben per Telegram oder über das Web-Formular
        </p>
      </div>
    );
  }

  // Group transactions by date
  const grouped = transactions.reduce((acc, tx) => {
    const date = new Date(tx.occurredOn).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, txs]) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-2">
            {date}
          </h3>
          <div className="space-y-2">
            {txs.map((tx, index) => (
              <div
                key={tx.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-xl transition-all duration-300 slide-in',
                  tx.confirmed ? 'bg-secondary/50 hover:bg-secondary/80' : 'bg-[hsl(45,90%,70%)]/10 border border-[hsl(45,90%,70%)]/30'
                )}
                style={{ animationDelay: `${index * 0.03}s` }}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {tx.category?.icon || '❓'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">
                        {tx.merchant || tx.category?.name || 'Sonstiges'}
                      </p>
                      {!tx.confirmed && (
                        <span className="flex items-center gap-1 text-xs text-[hsl(45,90%,70%)]">
                          <AlertCircle className="h-3 w-3" />
                          Unbestätigt
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tx.category && (
                        <span className="text-xs text-muted-foreground">
                          {tx.category.name}
                        </span>
                      )}
                      {tx.account && (
                        <span className="text-xs text-muted-foreground">
                          {tx.category && ' · '}{tx.account.name}
                        </span>
                      )}
                      {tx.direction === 'transfer' && tx.targetAccount && (
                        <span className="text-xs text-muted-foreground">
                          {' '}→ {tx.targetAccount.name}
                        </span>
                      )}
                      {tx.note && (
                        <span className="text-xs text-muted-foreground">
                          · {tx.note}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <p className={cn('font-bold text-lg whitespace-nowrap', directionColors[tx.direction])}>
                    {tx.direction === 'expense' ? '-' : tx.direction === 'income' ? '+' : ''}
                    {formatCurrency(tx.amountCents)}
                  </p>

                  <div className="flex items-center gap-1">
                    {!tx.confirmed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleConfirm(tx.id)}
                        className="hover:bg-[hsl(172,66%,65%)]/20 hover:text-[hsl(172,66%,65%)]"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/transactions/${tx.id}/edit`)}
                      className="hover:bg-primary/20 hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(tx.id)}
                      className="hover:bg-destructive/20 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle>Transaktion löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && handleDelete(deleteId)}
            >
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackToast feedback={feedback} />
    </div>
  );
}
