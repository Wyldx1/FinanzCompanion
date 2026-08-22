'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCurrency } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
  icon: string | null;
  isEssential: boolean;
}

interface Account {
  id: number;
  name: string;
  icon: string | null;
}

interface TransactionFormProps {
  categories: Category[];
  accounts: Account[];
  initialData?: {
    id: number;
    occurredOn: Date;
    amountCents: number;
    direction: 'expense' | 'income' | 'transfer';
    categoryId: number | null;
    accountId: number | null;
    merchant: string | null;
    note: string | null;
  };
  isEdit?: boolean;
}

const directions = [
  { value: 'expense', label: 'Ausgabe', icon: ArrowDownLeft, color: 'text-[hsl(330,80%,75%)]', bg: 'bg-[hsl(330,80%,75%)]/10', border: 'border-[hsl(330,80%,75%)]' },
  { value: 'income', label: 'Einnahme', icon: ArrowUpRight, color: 'text-[hsl(172,66%,65%)]', bg: 'bg-[hsl(172,66%,65%)]/10', border: 'border-[hsl(172,66%,65%)]' },
  { value: 'transfer', label: 'Umbuchung', icon: ArrowLeftRight, color: 'text-[hsl(210,80%,70%)]', bg: 'bg-[hsl(210,80%,70%)]/10', border: 'border-[hsl(210,80%,70%)]' },
];

export function TransactionForm({ categories, accounts, initialData, isEdit = false }: TransactionFormProps) {
  const router = useRouter();
  const [direction, setDirection] = useState<'expense' | 'income' | 'transfer'>(initialData?.direction || 'expense');
  const [amount, setAmount] = useState(
    initialData?.amountCents ? (initialData.amountCents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [date, setDate] = useState(
    initialData?.occurredOn
      ? new Date(initialData.occurredOn).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [categoryId, setCategoryId] = useState<number | null>(initialData?.categoryId || null);
  const [accountId, setAccountId] = useState<number | null>(initialData?.accountId || accounts.find(a => a)?.id || null);
  const [merchant, setMerchant] = useState(initialData?.merchant || '');
  const [note, setNote] = useState(initialData?.note || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const amountCents = parseCurrency(amount || '0');
    if (amountCents === null || amountCents <= 0) {
      setError('Bitte einen gültigen Betrag eingeben');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/transactions/${initialData?.id}` : '/api/transactions';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occurredOn: date,
          amountCents,
          direction,
          categoryId: categoryId || null,
          accountId: accountId || null,
          merchant: merchant || null,
          note: note || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/transactions');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  const selectedDirection = directions.find(d => d.value === direction);

  return (
    <Card className="glass gradient-border overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Receipt className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Transaktion bearbeiten' : 'Neue Transaktion'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit ? 'Transaktionsdetails anpassen' : 'Erfasse eine neue Ausgabe oder Einnahme'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Direction Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Art</label>
            <div className="grid grid-cols-3 gap-3">
              {directions.map((d) => {
                const Icon = d.icon;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDirection(d.value as typeof direction)}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all duration-300 text-center',
                      direction === d.value
                        ? `${d.border} ${d.bg}`
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <Icon className={cn('h-6 w-6 mx-auto mb-2', d.color)} />
                    <p className="text-sm font-medium">{d.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Betrag</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(
                  'text-3xl h-16 pr-16 text-center font-bold',
                  selectedDirection?.color
                )}
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                EUR
              </span>
            </div>
          </div>

          {/* Date Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Datum</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-12"
              required
            />
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Kategorie</label>
            <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
                  className={cn(
                    'p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center gap-1',
                    categoryId === cat.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <span className="text-xl">{cat.icon || '📦'}</span>
                  <span className="text-xs truncate w-full text-center">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Account Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Konto</label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setAccountId(acc.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2',
                    accountId === acc.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <span>{acc.icon || '💰'}</span>
                  <span className="text-sm">{acc.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Merchant */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Händler (optional)</label>
            <Input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="z.B. REWE, Amazon..."
              className="h-12"
            />
          </div>

          {/* Note */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Notiz (optional)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="z.B. Wocheneinkauf"
              className="h-12"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 glow">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  {isEdit ? 'Speichern' : 'Erfassen'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
