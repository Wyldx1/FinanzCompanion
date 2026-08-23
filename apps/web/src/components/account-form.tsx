'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Loader2, Sparkles, Building2, Euro } from 'lucide-react';
import { cn, parseCurrency } from '@/lib/utils';

const accountKinds = [
  { value: 'checking', label: 'Girokonto', icon: '🏦', description: 'Hauptkonto für tägliche Ausgaben' },
  { value: 'cash', label: 'Bargeld', icon: '💶', description: 'Bargeld zu Hause oder Portemonnaie' },
  { value: 'savings', label: 'Tagesgeld', icon: '🐷', description: 'Sparkonten und Festgeld' },
  { value: 'investment', label: 'Depot', icon: '📈', description: 'Aktien, ETFs, Fonds' },
  { value: 'receivable', label: 'Forderung', icon: '📋', description: 'Geld das dir geschuldet wird' },
  { value: 'liability', label: 'Schulden', icon: '💳', description: 'Kredite, Darlehen' },
];

interface AccountFormProps {
  initialData?: {
    id: number;
    name: string;
    kind: string;
    institution: string | null;
    icon: string | null;
    includeInNetworth: boolean;
    isDefaultPayment: boolean;
    notes: string | null;
  };
  isEdit?: boolean;
  defaultKind?: string;
}

export function AccountForm({ initialData, isEdit = false, defaultKind }: AccountFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name || '');
  const [kind, setKind] = useState(initialData?.kind || defaultKind || 'checking');
  const [institution, setInstitution] = useState(initialData?.institution || '');
  const [includeInNetworth, setIncludeInNetworth] = useState(initialData?.includeInNetworth ?? true);
  const [isDefaultPayment, setIsDefaultPayment] = useState(initialData?.isDefaultPayment ?? false);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [initialBalance, setInitialBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const showInitialBalance = !isEdit && kind === 'liability';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    let initialBalanceCents: number | null = null;
    if (showInitialBalance && initialBalance.trim()) {
      const parsed = parseCurrency(initialBalance);
      if (parsed === null) {
        setError('Bitte einen gültigen Betrag für den aktuellen Stand eingeben');
        setLoading(false);
        return;
      }
      initialBalanceCents = parsed;
    }

    try {
      const url = isEdit ? `/api/accounts/${initialData?.id}` : '/api/accounts';
      const method = isEdit ? 'PATCH' : 'POST';

      const body: Record<string, unknown> = {
        name,
        kind,
        institution: institution || null,
        icon: accountKinds.find((k) => k.value === kind)?.icon,
        includeInNetworth,
        isDefaultPayment,
        notes: notes || null,
      };
      if (initialBalanceCents !== null) {
        body.initialBalanceCents = initialBalanceCents;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || 'Fehler beim Speichern');
        return;
      }

      router.push('/accounts');
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
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>{isEdit ? 'Konto bearbeiten' : 'Neues Konto'}</CardTitle>
        </div>
        <CardDescription>
          {isEdit ? 'Kontodetails anpassen' : 'Füge ein neues Konto zu deinem Vermögen hinzu'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Kontoname</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Sparkasse Giro"
              className="h-12 text-lg"
              required
            />
          </div>

          {/* Account Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Kontotyp</label>
            <div className="grid grid-cols-2 gap-3">
              {accountKinds.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all duration-300 text-left',
                    kind === k.value
                      ? 'border-primary bg-primary/10 shadow-[0_0_20px_-5px_hsl(262,83%,75%,0.3)]'
                      : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{k.icon}</span>
                    <div>
                      <p className="font-medium">{k.label}</p>
                      <p className="text-xs text-muted-foreground">{k.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Institution Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Institut (optional)</label>
            <Input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="z.B. Sparkasse, Trade Republic"
              className="h-12"
            />
          </div>

          {/* Initial balance for liability accounts */}
          {showInitialBalance && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Aktueller Stand (optional)
              </label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  placeholder="z.B. 12.500,00"
                  className="h-12 pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  EUR
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Wird als aktueller Monatsabschluss für diese Schuld gespeichert.
              </p>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Optionen</label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIncludeInNetworth(!includeInNetworth)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 transition-all duration-300 text-left flex items-center justify-between',
                  includeInNetworth
                    ? 'border-[hsl(172,66%,65%)] bg-[hsl(172,66%,65%)]/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div>
                  <p className="font-medium">In Nettovermögen einbeziehen</p>
                  <p className="text-xs text-muted-foreground">Wird in der Vermögensübersicht angezeigt</p>
                </div>
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center',
                  includeInNetworth ? 'bg-[hsl(172,66%,65%)]' : 'bg-secondary'
                )}>
                  {includeInNetworth && <Check className="h-4 w-4 text-background" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsDefaultPayment(!isDefaultPayment)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 transition-all duration-300 text-left flex items-center justify-between',
                  isDefaultPayment
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div>
                  <p className="font-medium">Standard-Zahlungskonto</p>
                  <p className="text-xs text-muted-foreground">Wird für neue Transaktionen vorausgewählt</p>
                </div>
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center',
                  isDefaultPayment ? 'bg-primary' : 'bg-secondary'
                )}>
                  {isDefaultPayment && <Check className="h-4 w-4 text-background" />}
                </div>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">Notizen (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z.B. IBAN, Kontonummer..."
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
