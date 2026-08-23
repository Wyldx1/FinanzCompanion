'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, Repeat, Calendar, Wallet, Tag } from 'lucide-react';
import { cn, parseCurrency, getCurrentPeriod } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
  icon: string | null;
}

interface Account {
  id: number;
  name: string;
  icon: string | null;
  kind: string;
}

interface RecurringExpenseFormProps {
  categories: Category[];
  accounts: Account[];
  initialData?: {
    id: number;
    name: string;
    amountCents: number;
    direction: 'expense' | 'income' | 'transfer';
    categoryId: number | null;
    accountId: number | null;
    startPeriod: string;
    endPeriod: string | null;
    dayOfMonth: number;
    active: boolean;
  };
  isEdit?: boolean;
}

export function RecurringExpenseForm({
  categories,
  accounts,
  initialData,
  isEdit = false,
}: RecurringExpenseFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [amount, setAmount] = useState(
    initialData?.amountCents ? (initialData.amountCents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [direction, setDirection] = useState<'expense' | 'income'>(
    initialData?.direction === 'income' ? 'income' : 'expense'
  );
  const [categoryId, setCategoryId] = useState<string>(
    initialData?.categoryId ? String(initialData.categoryId) : ''
  );
  const [accountId, setAccountId] = useState<string>(
    initialData?.accountId ? String(initialData.accountId) : ''
  );
  const [startPeriod, setStartPeriod] = useState(initialData?.startPeriod || getCurrentPeriod());
  const [endPeriod, setEndPeriod] = useState(initialData?.endPeriod || '');
  const [dayOfMonth, setDayOfMonth] = useState(
    initialData?.dayOfMonth ? String(initialData.dayOfMonth) : '1'
  );
  const [active, setActive] = useState(initialData?.active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const amountCents = parseCurrency(amount || '0');
    if (amountCents === null) {
      setError('Bitte einen gültigen Betrag eingeben');
      setLoading(false);
      return;
    }

    const day = parseInt(dayOfMonth);
    if (isNaN(day) || day < 1 || day > 31) {
      setError('Tag muss zwischen 1 und 31 liegen');
      setLoading(false);
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(startPeriod)) {
      setError('Startperiode muss im Format YYYY-MM sein');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/recurring-expenses/${initialData?.id}` : '/api/recurring-expenses';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amountCents,
          direction,
          categoryId: categoryId ? parseInt(categoryId) : null,
          accountId: accountId ? parseInt(accountId) : null,
          startPeriod,
          endPeriod: endPeriod || null,
          dayOfMonth: day,
          active,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/recurring-expenses');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass gradient-border overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Repeat className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Dauerauftrag bearbeiten' : 'Neuer Dauerauftrag'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit
            ? 'Details des wiederkehrenden Buchung anpassen'
            : 'Erfasse eine monatlich wiederkehrende Buchung'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Bezeichnung</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Miete, Versicherung"
              className="h-12"
              required
            />
          </div>

          {/* Amount */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Betrag</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-3xl h-16 pr-16 text-center font-bold"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                EUR
              </span>
            </div>
          </div>

          {/* Direction */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Richtung</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDirection('expense')}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all duration-300 text-left',
                  direction === 'expense'
                    ? 'border-[hsl(330,80%,75%)] bg-[hsl(330,80%,75%)]/10'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                )}
              >
                <p className="font-medium">Ausgabe</p>
                <p className="text-xs text-muted-foreground">Abgehend</p>
              </button>
              <button
                type="button"
                onClick={() => setDirection('income')}
                className={cn(
                  'p-4 rounded-xl border-2 transition-all duration-300 text-left',
                  direction === 'income'
                    ? 'border-[hsl(172,66%,65%)] bg-[hsl(172,66%,65%)]/10'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                )}
              >
                <p className="font-medium">Einnahme</p>
                <p className="text-xs text-muted-foreground">Zugehend</p>
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Kategorie
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-12 rounded-xl border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Keine Kategorie</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon || ''} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Account */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Konto
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full h-12 rounded-xl border border-input bg-background px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Kein Konto</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.icon || ''} {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Periods */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start
              </label>
              <Input
                type="month"
                value={startPeriod}
                onChange={(e) => setStartPeriod(e.target.value)}
                className="h-12"
                required
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Ende (optional)</label>
              <Input
                type="month"
                value={endPeriod}
                onChange={(e) => setEndPeriod(e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          {/* Day of month */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Tag im Monat</label>
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              className="h-12"
              required
            />
          </div>

          {/* Active */}
          <button
            type="button"
            onClick={() => setActive(!active)}
            className={cn(
              'w-full p-4 rounded-xl border-2 transition-all duration-300 text-left flex items-center justify-between',
              active
                ? 'border-[hsl(172,66%,65%)] bg-[hsl(172,66%,65%)]/10'
                : 'border-border hover:border-primary/50'
            )}
          >
            <div>
              <p className="font-medium">Aktiv</p>
              <p className="text-xs text-muted-foreground">
                {active ? 'Wird monatlich ausgeführt' : 'Vorübergehend pausiert'}
              </p>
            </div>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center',
              active ? 'bg-[hsl(172,66%,65%)]' : 'bg-secondary'
            )}>
              {active && <Check className="h-4 w-4 text-background" />}
            </div>
          </button>

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
                  {isEdit ? 'Speichern' : 'Erstellen'}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
