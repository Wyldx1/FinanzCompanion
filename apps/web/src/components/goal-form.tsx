'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, Target, PiggyBank, ShoppingBag, CreditCard, Landmark, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseCurrency } from '@/lib/utils';

interface Account {
  id: number;
  name: string;
  icon: string | null;
}

interface GoalFormProps {
  accounts: Account[];
  initialData?: {
    id: number;
    name: string;
    kind: 'emergency_fund' | 'purchase' | 'debt_payoff' | 'retirement' | 'custom';
    targetCents: number;
    targetDate: Date | null;
    priority: number;
    linkedAccountId: number | null;
    monthlyPlanCents: number | null;
  };
  isEdit?: boolean;
}

const goalKinds = [
  { value: 'emergency_fund', label: 'Notgroschen', icon: PiggyBank, color: 'text-[hsl(172,66%,65%)]', bg: 'bg-[hsl(172,66%,65%)]/10', border: 'border-[hsl(172,66%,65%)]', description: '3-6 Monate Ausgaben' },
  { value: 'purchase', label: 'Anschaffung', icon: ShoppingBag, color: 'text-[hsl(262,83%,75%)]', bg: 'bg-[hsl(262,83%,75%)]/10', border: 'border-[hsl(262,83%,75%)]', description: 'Sparen für etwas Bestimmtes' },
  { value: 'debt_payoff', label: 'Schuldentilgung', icon: CreditCard, color: 'text-[hsl(330,80%,75%)]', bg: 'bg-[hsl(330,80%,75%)]/10', border: 'border-[hsl(330,80%,75%)]', description: 'Schulden abbauen' },
  { value: 'retirement', label: 'Altersvorsorge', icon: Landmark, color: 'text-[hsl(210,80%,70%)]', bg: 'bg-[hsl(210,80%,70%)]/10', border: 'border-[hsl(210,80%,70%)]', description: 'Langfristige Vorsorge' },
  { value: 'custom', label: 'Benutzerdefiniert', icon: Sparkles, color: 'text-[hsl(45,90%,70%)]', bg: 'bg-[hsl(45,90%,70%)]/10', border: 'border-[hsl(45,90%,70%)]', description: 'Eigenes Ziel definieren' },
];

export function GoalForm({ accounts, initialData, isEdit = false }: GoalFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [kind, setKind] = useState<'emergency_fund' | 'purchase' | 'debt_payoff' | 'retirement' | 'custom'>(initialData?.kind || 'emergency_fund');
  const [targetAmount, setTargetAmount] = useState(
    initialData?.targetCents ? (initialData.targetCents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [targetDate, setTargetDate] = useState(
    initialData?.targetDate
      ? new Date(initialData.targetDate).toISOString().split('T')[0]
      : ''
  );
  const [monthlyPlan, setMonthlyPlan] = useState(
    initialData?.monthlyPlanCents ? (initialData.monthlyPlanCents / 100).toFixed(2).replace('.', ',') : ''
  );
  const [linkedAccountId, setLinkedAccountId] = useState<number | null>(initialData?.linkedAccountId || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const targetCents = parseCurrency(targetAmount || '0');
    if (targetCents === null || targetCents <= 0) {
      setError('Bitte einen gültigen Zielbetrag eingeben');
      setLoading(false);
      return;
    }

    const monthlyPlanCents = monthlyPlan ? parseCurrency(monthlyPlan) : null;

    try {
      const url = isEdit ? `/api/goals/${initialData?.id}` : '/api/goals';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          kind,
          targetCents,
          targetDate: targetDate || null,
          linkedAccountId: linkedAccountId || null,
          monthlyPlanCents: monthlyPlanCents || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/goals');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  const selectedKind = goalKinds.find(k => k.value === kind);

  return (
    <Card className="glass gradient-border overflow-hidden">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Ziel bearbeiten' : 'Neues Ziel'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit ? 'Zieldetails anpassen' : 'Setze dir ein neues finanzielles Ziel'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Goal Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Zieltyp</label>
            <div className="grid grid-cols-2 gap-3">
              {goalKinds.map((k) => {
                const Icon = k.icon;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => setKind(k.value as typeof kind)}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all duration-300 text-left',
                      kind === k.value
                        ? `${k.border} ${k.bg}`
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn('h-6 w-6', k.color)} />
                      <div>
                        <p className="font-medium text-sm">{k.label}</p>
                        <p className="text-xs text-muted-foreground">{k.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Bezeichnung</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Notgroschen aufbauen"
              className="h-12"
              required
            />
          </div>

          {/* Target Amount */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Zielbetrag</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className={cn(
                  'text-3xl h-16 pr-16 text-center font-bold',
                  selectedKind?.color
                )}
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                EUR
              </span>
            </div>
          </div>

          {/* Target Date */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Zieldatum (optional)</label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-12"
            />
          </div>

          {/* Monthly Plan */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Monatlicher Sparbetrag (optional)</label>
            <div className="relative">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={monthlyPlan}
                onChange={(e) => setMonthlyPlan(e.target.value)}
                className="h-12 pr-16"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                EUR/Monat
              </span>
            </div>
          </div>

          {/* Link to Account */}
          {accounts.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground">Mit Konto verknüpfen (optional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLinkedAccountId(null)}
                  className={cn(
                    'px-4 py-2 rounded-xl border-2 transition-all duration-300',
                    linkedAccountId === null
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <span className="text-sm">Keine Verknüpfung</span>
                </button>
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setLinkedAccountId(acc.id)}
                    className={cn(
                      'px-4 py-2 rounded-xl border-2 transition-all duration-300 flex items-center gap-2',
                      linkedAccountId === acc.id
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
