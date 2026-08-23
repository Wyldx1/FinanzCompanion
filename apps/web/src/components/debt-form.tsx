'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, CreditCard, TrendingDown } from 'lucide-react';
import { cn, parseCurrency } from '@/lib/utils';

interface DebtFormProps {
  initialData?: {
    id: number;
    creditor: string;
    originalCents: number;
    interestRateBps: number;
    minimumPaymentCents: number;
    dueDay: number | null;
    targetPayoffDate: Date | null;
  };
  isEdit?: boolean;
}

export function DebtForm({ initialData, isEdit = false }: DebtFormProps) {
  const router = useRouter();
  const [creditor, setCreditor] = useState(initialData?.creditor || '');
  const [originalAmount, setOriginalAmount] = useState(
    initialData?.originalCents ? (initialData.originalCents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [interestRate, setInterestRate] = useState(
    initialData?.interestRateBps ? (initialData.interestRateBps / 100).toFixed(2).replace('.', ',') : ''
  );
  const [minimumPayment, setMinimumPayment] = useState(
    initialData?.minimumPaymentCents ? (initialData.minimumPaymentCents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [dueDay, setDueDay] = useState(initialData?.dueDay ? String(initialData.dueDay) : '');
  const [targetPayoffDate, setTargetPayoffDate] = useState(
    initialData?.targetPayoffDate
      ? new Date(initialData.targetPayoffDate).toISOString().split('T')[0]
      : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const originalCents = parseCurrency(originalAmount || '0');
    if (originalCents === null) {
      setError('Bitte einen gültigen ursprünglichen Betrag eingeben');
      setLoading(false);
      return;
    }

    const minimumPaymentCents = parseCurrency(minimumPayment || '0');
    if (minimumPaymentCents === null) {
      setError('Bitte eine gültige Mindestzahlung eingeben');
      setLoading(false);
      return;
    }

    const interestRateNum = parseFloat(interestRate.replace(',', '.') || '0');
    if (isNaN(interestRateNum) || interestRateNum < 0 || interestRateNum > 100) {
      setError('Zinssatz muss zwischen 0 und 100 liegen');
      setLoading(false);
      return;
    }

    const dueDayNum = dueDay ? parseInt(dueDay) : null;
    if (dueDayNum !== null && (dueDayNum < 1 || dueDayNum > 31)) {
      setError('Solltag muss zwischen 1 und 31 liegen');
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/api/debts/${initialData?.id}` : '/api/debts';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditor,
          originalCents,
          interestRatePercent: interestRateNum,
          minimumPaymentCents,
          dueDay: dueDayNum,
          targetPayoffDate: targetPayoffDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/debts');
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
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Schuld bearbeiten' : 'Neue Schuld'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit
            ? 'Schulddetails anpassen'
            : 'Erfasse eine neue Schuld. Das passende Konto wird automatisch angelegt.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Creditor */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Gläubiger</label>
            <Input
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              placeholder="z.B. Bank XY, Privatperson"
              className="h-12"
              required
            />
          </div>

          {/* Original Amount */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Ursprüngliche Höhe</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={originalAmount}
                onChange={(e) => setOriginalAmount(e.target.value)}
                className="text-3xl h-16 pr-16 text-center font-bold text-[hsl(330,80%,75%)]"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                EUR
              </span>
            </div>
          </div>

          {/* Interest Rate */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Zinssatz (p.a.)</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="h-12 pr-12"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                %
              </span>
            </div>
          </div>

          {/* Minimum Payment */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Mindestzahlung (monatlich)</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={minimumPayment}
                onChange={(e) => setMinimumPayment(e.target.value)}
                className="h-12 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                EUR/Monat
              </span>
            </div>
          </div>

          {/* Due Day */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Solltag (optional)</label>
            <Input
              type="number"
              min={1}
              max={31}
              placeholder="z.B. 15"
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="h-12"
            />
          </div>

          {/* Target Payoff Date */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Tilgungsziel (optional)</label>
            <Input
              type="date"
              value={targetPayoffDate}
              onChange={(e) => setTargetPayoffDate(e.target.value)}
              className="h-12"
            />
          </div>

          {!isEdit && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
              <TrendingDown className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Der aktuelle Stand der Schuld wird im Monatsabschluss erfasst. Hier legst du nur die Metadaten an.
              </p>
            </div>
          )}

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
