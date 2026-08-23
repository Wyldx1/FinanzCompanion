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
import { Pencil, Trash2, CreditCard, Calendar, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Debt {
  id: number;
  creditor: string;
  originalCents: number;
  interestRateBps: number;
  minimumPaymentCents: number;
  dueDay: number | null;
  targetPayoffDate: Date | null;
  currentBalanceCents: number;
  account: {
    id: number;
    name: string;
  };
}

interface DebtListProps {
  debts: Debt[];
}

export function DebtList({ debts }: DebtListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { feedback, showFeedback } = useFeedback();

  async function handleDelete(id: number) {
    setDeleteId(null);

    const res = await fetch(`/api/debts/${id}`, {
      method: 'DELETE',
    });

    showFeedback(
      res.ok
        ? { text: 'Schuld gelöscht', kind: 'success' }
        : { text: 'Löschen fehlgeschlagen', kind: 'error' }
    );

    router.refresh();
  }

  if (debts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">💳</span>
        </div>
        <p className="text-lg text-foreground mb-2">Keine Schulden erfasst</p>
        <p className="text-muted-foreground text-sm">
          Füge eine neue Schuld hinzu, um sie hier zu verwalten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {debts.map((debt, index) => {
        const progress = debt.originalCents > 0
          ? Math.max(0, Math.min(100, ((debt.originalCents - debt.currentBalanceCents) / debt.originalCents) * 100))
          : 0;
        const remaining = debt.currentBalanceCents;

        return (
          <div
            key={debt.id}
            className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-xl bg-[hsl(330,80%,75%)]/10 flex items-center justify-center text-2xl flex-shrink-0">
                  <CreditCard className="h-6 w-6 text-[hsl(330,80%,75%)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-lg truncate">{debt.creditor}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    {debt.interestRateBps > 0 && (
                      <span>{(debt.interestRateBps / 100).toFixed(2)} % Zinsen</span>
                    )}
                    {debt.minimumPaymentCents > 0 && (
                      <span>min. {formatCurrency(debt.minimumPaymentCents)}/Monat</span>
                    )}
                    {debt.dueDay && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Solltag {debt.dueDay}.
                      </span>
                    )}
                    {debt.targetPayoffDate && (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Ziel: {new Date(debt.targetPayoffDate).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Restschuld</span>
                      <span className="font-semibold">{formatCurrency(remaining)}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[hsl(330,80%,75%)] to-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(debt.originalCents)} ursprünglich</span>
                      <span>{Math.round(progress)}% getilgt</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/debts/${debt.id}/edit`)}
                  className="hover:bg-primary/20 hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(debt.id)}
                  className="hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle>Schuld löschen?</DialogTitle>
            <DialogDescription>
              Das zugehörige Konto wird archiviert. Bestehende Monatsabschlüsse bleiben erhalten.
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
