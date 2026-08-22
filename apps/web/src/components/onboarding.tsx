'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Wallet,
  PiggyBank,
  TrendingUp,
  Bot,
  Target,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    id: 'welcome',
    title: 'Willkommen beim Finanz-Companion!',
    subtitle: 'Dein persönlicher Begleiter für finanzielle Klarheit',
    icon: Sparkles,
    color: 'from-[hsl(262,83%,75%)] to-[hsl(172,66%,65%)]',
  },
  {
    id: 'concept',
    title: 'Monatliche Snapshots',
    subtitle: 'Kein tägliches Tracking nötig - einmal im Monat reicht',
    icon: TrendingUp,
    color: 'from-[hsl(172,66%,65%)] to-[hsl(210,80%,70%)]',
  },
  {
    id: 'accounts',
    title: 'Deine Konten',
    subtitle: 'Erfasse alle Konten, Depots und Bargeld',
    icon: Wallet,
    color: 'from-[hsl(210,80%,70%)] to-[hsl(262,83%,75%)]',
  },
  {
    id: 'goals',
    title: 'Setze dir Ziele',
    subtitle: 'Notgroschen, Anschaffungen, Schuldentilgung',
    icon: Target,
    color: 'from-[hsl(262,83%,75%)] to-[hsl(330,80%,75%)]',
  },
  {
    id: 'telegram',
    title: 'Telegram Bot',
    subtitle: 'Erfasse Ausgaben unterwegs per Nachricht',
    icon: Bot,
    color: 'from-[hsl(330,80%,75%)] to-[hsl(45,90%,70%)]',
  },
  {
    id: 'ready',
    title: 'Bereit zum Start!',
    subtitle: 'Beginne mit deinem ersten Monatsabschluss',
    icon: PiggyBank,
    color: 'from-[hsl(45,90%,70%)] to-[hsl(172,66%,65%)]',
  },
];

const stepContent: Record<string, React.ReactNode> = {
  welcome: (
    <div className="space-y-4 text-center">
      <p className="text-muted-foreground">
        Der Finanz-Companion hilft dir, dein Vermögen zu tracken und
        bessere finanzielle Entscheidungen zu treffen.
      </p>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="p-4 rounded-xl bg-secondary/50">
          <p className="text-2xl mb-2">📊</p>
          <p className="text-sm font-medium">Vermögen tracken</p>
        </div>
        <div className="p-4 rounded-xl bg-secondary/50">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm font-medium">Ziele setzen</p>
        </div>
        <div className="p-4 rounded-xl bg-secondary/50">
          <p className="text-2xl mb-2">🤖</p>
          <p className="text-sm font-medium">KI-Coaching</p>
        </div>
      </div>
    </div>
  ),
  concept: (
    <div className="space-y-4 text-center">
      <p className="text-muted-foreground">
        Statt jede Ausgabe zu tracken, machst du einmal im Monat einen
        "Snapshot" deiner Kontostände. Das dauert nur 2 Minuten!
      </p>
      <div className="p-6 rounded-xl bg-gradient-to-r from-primary/10 to-[hsl(172,66%,65%)]/10">
        <p className="font-medium mb-2">So funktioniert's:</p>
        <ol className="text-sm text-left space-y-2 text-muted-foreground">
          <li>1. Am Monatsende alle Kontostände eingeben</li>
          <li>2. Einkommen erfassen</li>
          <li>3. Fertig - die App berechnet den Rest</li>
        </ol>
      </div>
    </div>
  ),
  accounts: (
    <div className="space-y-4 text-center">
      <p className="text-muted-foreground">
        Lege alle Konten an, die du tracken möchtest:
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-secondary/50 flex items-center gap-3">
          <span className="text-xl">🏦</span>
          <span className="text-sm">Girokonto</span>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 flex items-center gap-3">
          <span className="text-xl">💶</span>
          <span className="text-sm">Bargeld</span>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 flex items-center gap-3">
          <span className="text-xl">🐷</span>
          <span className="text-sm">Tagesgeld</span>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 flex items-center gap-3">
          <span className="text-xl">📈</span>
          <span className="text-sm">Depot</span>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 flex items-center gap-3">
          <span className="text-xl">💳</span>
          <span className="text-sm">Kreditkarte</span>
        </div>
        <div className="p-3 rounded-xl bg-secondary/50 flex items-center gap-3">
          <span className="text-xl">🏠</span>
          <span className="text-sm">Kredit</span>
        </div>
      </div>
    </div>
  ),
  goals: (
    <div className="space-y-4 text-center">
      <p className="text-muted-foreground">
        Definiere finanzielle Ziele und verfolge deinen Fortschritt:
      </p>
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-[hsl(172,66%,65%)]/10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[hsl(172,66%,65%)]/20 flex items-center justify-center">
            <PiggyBank className="h-5 w-5 text-[hsl(172,66%,65%)]" />
          </div>
          <div className="text-left">
            <p className="font-medium">Notgroschen</p>
            <p className="text-xs text-muted-foreground">3-6 Monate Ausgaben</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[hsl(262,83%,75%)]/10 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[hsl(262,83%,75%)]/20 flex items-center justify-center">
            <Target className="h-5 w-5 text-[hsl(262,83%,75%)]" />
          </div>
          <div className="text-left">
            <p className="font-medium">Anschaffungen</p>
            <p className="text-xs text-muted-foreground">Urlaub, Auto, Möbel...</p>
          </div>
        </div>
      </div>
    </div>
  ),
  telegram: (
    <div className="space-y-4 text-center">
      <p className="text-muted-foreground">
        Optional: Verbinde einen Telegram-Bot für schnelle Ausgabenerfassung.
      </p>
      <div className="p-6 rounded-xl bg-[hsl(210,80%,70%)]/10">
        <p className="font-mono text-sm mb-3">14,50 Rewe</p>
        <p className="text-xs text-muted-foreground">
          Schreib einfach den Betrag und Händler - der Bot erkennt die Kategorie automatisch.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Du kannst den Bot später in den Einstellungen verbinden.
      </p>
    </div>
  ),
  ready: (
    <div className="space-y-4 text-center">
      <p className="text-muted-foreground">
        Alles ist bereit! Du kannst jetzt mit dem Tracking deiner Finanzen beginnen.
      </p>
      <div className="p-6 rounded-xl bg-gradient-to-r from-primary/10 to-[hsl(172,66%,65%)]/10">
        <Check className="h-8 w-8 text-[hsl(172,66%,65%)] mx-auto mb-3" />
        <p className="font-medium">Jetzt geht's los!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Lege deine Konten an und erstelle deinen ersten Snapshot.
        </p>
      </div>
    </div>
  ),
};

export function Onboarding({ onComplete }: OnboardingProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === steps.length - 1;

  async function handleComplete() {
    setLoading(true);
    try {
      await fetch('/api/onboarding', { method: 'POST' });
      onComplete();
      router.refresh();
    } catch (error) {
      console.error('Onboarding error:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg glass gradient-border overflow-hidden">
        <CardContent className="p-0">
          {/* Progress */}
          <div className="h-1 bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-primary to-[hsl(172,66%,65%)] transition-all duration-500"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="p-8">
            {/* Icon */}
            <div className={cn(
              'w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-gradient-to-br glow',
              step.color
            )}>
              <Icon className="h-10 w-10 text-white" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-center mb-2">{step.title}</h2>
            <p className="text-muted-foreground text-center mb-8">{step.subtitle}</p>

            {/* Content */}
            <div className="mb-8">
              {stepContent[step.id]}
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Zurück
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={loading}
                className={cn('flex-1 glow', currentStep === 0 && 'w-full')}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLastStep ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Los geht's!
                  </>
                ) : (
                  <>
                    Weiter
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Skip */}
            {!isLastStep && (
              <button
                onClick={handleComplete}
                className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Überspringen
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
