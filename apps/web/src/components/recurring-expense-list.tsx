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
import { Pencil, Trash2, Repeat, Calendar, Wallet, Tag, CheckCircle2, PauseCircle } from 'lucide-react';
import { formatCurrency, formatPeriod } from '@/lib/utils';

interface RecurringExpense {
  id: number;
  name: string;
  amountCents: number;
  direction: 'expense' | 'income' | 'transfer';
  dayOfMonth: number;
  startPeriod: string;
  endPeriod: string | null;
  active: boolean;
  category: { id: number; name: string; icon: string | null } | null;
  account: { id: number; name: string; icon: string | null } | null;
}

interface RecurringExpenseListProps {
  items: RecurringExpense[];
}

export function RecurringExpenseList({ items }: RecurringExpenseListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { feedback, showFeedback } = useFeedback();

  async function handleDelete(id: number) {
    setDeleteId(null);

    const res = await fetch(`/api/recurring-expenses/${id}`, {
      method: 'DELETE',
    });

    showFeedback(
      res.ok
        ? { text: 'Dauerauftrag gelöscht', kind: 'success' }
        : { text: 'Löschen fehlgeschlagen', kind: 'error' }
    );

    router.refresh();
  }

  async function handleToggleActive(item: RecurringExpense) {
    const res = await fetch(`/api/recurring-expenses/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });

    showFeedback(
      res.ok
        ? { text: item.active ? 'Dauerauftrag pausiert' : 'Dauerauftrag aktiviert', kind: 'success' }
        : { text: 'Aktualisierung fehlgeschlagen', kind: 'error' }
    );

    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">🔄</span>
        </div>
        <p className="text-lg text-foreground mb-2">Keine Daueraufträge</p>
        <p className="text-muted-foreground text-sm">
          Lege einen Dauerauftrag an, um monatliche Buchungen automatisch zu erfassen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="p-4 rounded-xl bg-secondary/50 hover:bg-secondary/80 transition-all duration-300 slide-in"
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                <Repeat className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-lg truncate">{item.name}</p>
                  {!item.active && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                      Pausiert
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {item.dayOfMonth}. jeden Monats
                  </span>
                  {item.category && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {item.category.name}
                    </span>
                  )}
                  {item.account && (
                    <span className="flex items-center gap-1">
                      <Wallet className="h-3 w-3" />
                      {item.account.name}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  Ab {formatPeriod(item.startPeriod)}
                  {item.endPeriod && ` bis ${formatPeriod(item.endPeriod)}`}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <p className={`font-bold text-lg ${
                item.direction === 'expense' ? 'text-[hsl(330,80%,75%)]' : 'text-[hsl(172,66%,65%)]'
              }`}>
                {item.direction === 'expense' ? '-' : '+'}{formatCurrency(item.amountCents)}
              </p>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggleActive(item)}
                  className={item.active ? 'hover:bg-[hsl(45,90%,70%)]/20 hover:text-[hsl(45,90%,70%)]' : 'hover:bg-[hsl(172,66%,65%)]/20 hover:text-[hsl(172,66%,65%)]'}
                  title={item.active ? 'Pausieren' : 'Aktivieren'}
                >
                  {item.active ? <PauseCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push(`/recurring-expenses/${item.id}/edit`)}
                  className="hover:bg-primary/20 hover:text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(item.id)}
                  className="hover:bg-destructive/20 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}

      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="glass border-white/10">
          <DialogHeader>
            <DialogTitle>Dauerauftrag löschen?</DialogTitle>
            <DialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Bereits erzeugte Transaktionen bleiben erhalten.
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
