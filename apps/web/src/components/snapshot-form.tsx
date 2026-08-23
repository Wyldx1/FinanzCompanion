'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { formatCurrency, formatPeriod, parseCurrency } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';

interface Account {
  id: number;
  name: string;
  kind: string;
  icon: string | null;
}

interface SnapshotFormProps {
  period: string;
  accounts: Account[];
  initialValues: Record<number, number>;
  projectedValues: Record<number, number>;
  initialIncome: number;
  initialNote: string;
  isEdit: boolean;
}

export function SnapshotForm({
  period,
  accounts,
  initialValues,
  projectedValues,
  initialIncome,
  initialNote,
  isEdit,
}: SnapshotFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<number, string>>(() => {
    const v: Record<number, string> = {};
    for (const acc of accounts) {
      const cents = initialValues[acc.id] || 0;
      v[acc.id] = (cents / 100).toFixed(2).replace('.', ',');
    }
    return v;
  });
  const [income, setIncome] = useState(
    initialIncome ? (initialIncome / 100).toFixed(2).replace('.', ',') : ''
  );
  const [note, setNote] = useState(initialNote);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const totalSteps = accounts.length + 2;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  async function handleSave(complete: boolean) {
    setError('');
    setLoading(true);

    try {
      const balances: { accountId: number; balanceCents: number }[] = [];

      for (const acc of accounts) {
        const cents = parseCurrency(values[acc.id] || '0');
        if (cents === null) {
          setError(`Ungültiger Betrag für ${acc.name}`);
          setLoading(false);
          return;
        }
        balances.push({ accountId: acc.id, balanceCents: cents });
      }

      const incomeCents = parseCurrency(income || '0');
      if (incomeCents === null) {
        setError('Ungültiger Einkommensbetrag');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          balances,
          incomeCents,
          note: note || null,
          complete,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  const currentAccount = accounts[currentStep];
  const isIncomeStep = currentStep === accounts.length;
  const isNoteStep = currentStep === accounts.length + 1;

  function handleNext() {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isNoteStep) {
        handleSave(true);
      } else {
        handleNext();
      }
    }
  }

  return (
    <Card className="glass gradient-border overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Monatsabschluss</CardTitle>
        </div>
        <CardDescription>{formatPeriod(period)}</CardDescription>

        {/* Progress bar */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Schritt {currentStep + 1} von {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-[hsl(172,66%,65%)] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {!isIncomeStep && !isNoteStep && currentAccount && (
          <div className="space-y-6 slide-in" key={currentAccount.id}>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30">
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center text-2xl">
                {currentAccount.icon || '💰'}
              </div>
              <div>
                <h3 className="text-lg font-semibold">{currentAccount.name}</h3>
                <p className="text-sm text-muted-foreground">
                  Vormonat: {formatCurrency(initialValues[currentAccount.id] || 0)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {projectedValues[currentAccount.id] !== undefined && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    Laut erfassten Transaktionen erwartet:
                  </p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(projectedValues[currentAccount.id])}
                  </p>
                </div>
              )}

              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={values[currentAccount.id]}
                  onChange={(e) =>
                    setValues({ ...values, [currentAccount.id]: e.target.value })
                  }
                  onKeyDown={handleKeyDown}
                  className="text-3xl h-16 pr-16 text-center font-bold"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                  EUR
                </span>
              </div>

              {(() => {
                const entered = parseCurrency(values[currentAccount.id] || '0');
                const projected = projectedValues[currentAccount.id];
                if (entered === null || projected === undefined) return null;
                const diff = entered - projected;
                if (diff === 0) return null;
                return (
                  <p className={`text-sm text-center ${diff > 0 ? 'text-[hsl(172,66%,65%)]' : 'text-[hsl(330,80%,75%)]'}`}>
                    Abweichung zur Projektion: {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                  </p>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={() =>
                    setValues({
                      ...values,
                      [currentAccount.id]: ((initialValues[currentAccount.id] || 0) / 100)
                        .toFixed(2)
                        .replace('.', ','),
                    })
                  }
                >
                  <Check className="mr-2 h-4 w-4" />
                  Unverändert
                </Button>

                {projectedValues[currentAccount.id] !== undefined && (
                  <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={() =>
                      setValues({
                        ...values,
                        [currentAccount.id]: (projectedValues[currentAccount.id] / 100)
                          .toFixed(2)
                          .replace('.', ','),
                      })
                    }
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Vorschlag
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {isIncomeStep && (
          <div className="space-y-6 slide-in">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[hsl(172,66%,65%)]/10">
              <div className="w-14 h-14 rounded-xl bg-[hsl(172,66%,65%)]/20 flex items-center justify-center text-2xl">
                💰
              </div>
              <div>
                <h3 className="text-lg font-semibold">Nettoeinkommen</h3>
                <p className="text-sm text-muted-foreground">
                  Gehalt und andere Einnahmen
                </p>
              </div>
            </div>

            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-3xl h-16 pr-16 text-center font-bold"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                EUR
              </span>
            </div>
          </div>
        )}

        {isNoteStep && (
          <div className="space-y-6 slide-in">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/10">
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center text-2xl">
                📝
              </div>
              <div>
                <h3 className="text-lg font-semibold">Notiz zum Monat</h3>
                <p className="text-sm text-muted-foreground">
                  Optional: Urlaub, Bonus, besondere Ausgaben...
                </p>
              </div>
            </div>

            <Input
              type="text"
              placeholder="z.B. Urlaub Italien, Bonus erhalten..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-lg h-14"
              autoFocus
            />
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between gap-3 pt-6">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>

        {isNoteStep ? (
          <div className="flex gap-2 flex-[2]">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={loading}
              className="flex-1"
            >
              Entwurf
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={loading}
              className="flex-1 glow"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Abschließen
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button onClick={handleNext} className="flex-1 glow">
            Weiter
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
