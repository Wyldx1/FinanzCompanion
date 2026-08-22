import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { db } from '@/lib/db';
import { adviceLog, snapshots } from '@finanz/db/schema';
import { desc, eq } from 'drizzle-orm';
import { formatPeriod, getCurrentPeriod } from '@/lib/utils';
import { Bot, MessageSquare, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { CoachActions } from '@/components/coach-actions';

const triggerConfig = {
  monthly: { label: 'Monatliche Auswertung', color: 'text-[hsl(262,83%,75%)]', bg: 'bg-[hsl(262,83%,75%)]/10' },
  on_demand: { label: 'Auf Abruf', color: 'text-[hsl(172,66%,65%)]', bg: 'bg-[hsl(172,66%,65%)]/10' },
  alert: { label: 'Warnung', color: 'text-[hsl(330,80%,75%)]', bg: 'bg-[hsl(330,80%,75%)]/10' },
};

export default async function CoachPage() {
  const currentPeriod = getCurrentPeriod();

  const [adviceLogs, currentSnapshot] = await Promise.all([
    db.query.adviceLog.findMany({
      orderBy: [desc(adviceLog.createdAt)],
      limit: 12,
    }),
    db.query.snapshots.findFirst({
      where: eq(snapshots.period, currentPeriod),
    }),
  ]);

  const canRequestCoaching = currentSnapshot?.status === 'complete';
  const hasCurrentPeriodAdvice = adviceLogs.some(a => a.period === currentPeriod);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gradient-text">Coach</h1>
          <p className="text-muted-foreground mt-1">
            Dein persönlicher Finanz-Berater
          </p>
        </div>
      </div>

      {/* Request Coaching Card */}
      <Card className="glass gradient-border overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-[hsl(172,66%,65%)] flex items-center justify-center glow">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">KI-Coaching anfordern</h2>
              <p className="text-muted-foreground text-sm">
                {canRequestCoaching
                  ? hasCurrentPeriodAdvice
                    ? 'Du hast bereits eine Auswertung für diesen Monat erhalten.'
                    : 'Erhalte eine personalisierte Analyse deiner Finanzen für diesen Monat.'
                  : 'Schließe zuerst deinen Monatsabschluss ab, um eine Auswertung zu erhalten.'}
              </p>
            </div>
            <CoachActions
              canRequest={canRequestCoaching && !hasCurrentPeriodAdvice}
              period={currentPeriod}
            />
          </div>
        </CardContent>
      </Card>

      {/* Advice History */}
      <Card className="glass overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Coaching-Verlauf
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adviceLogs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <p className="text-lg text-foreground mb-2">Noch keine Coach-Auswertungen</p>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Nach deinem ersten abgeschlossenen Monatsabschluss erhältst du hier
                eine personalisierte Analyse und Empfehlungen.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {adviceLogs.map((advice, index) => {
                const commitments = advice.commitments as Array<{
                  id: string;
                  text: string;
                }>;
                const config = triggerConfig[advice.trigger];

                return (
                  <div
                    key={advice.id}
                    className="p-5 rounded-xl bg-secondary/50 slide-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{formatPeriod(advice.period)}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(advice.createdAt).toLocaleDateString('de-DE')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Verdict */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-[hsl(172,66%,65%)]/10 mb-4">
                      <p className="font-semibold text-lg">{advice.verdict}</p>
                    </div>

                    {/* Body */}
                    <div className="prose prose-sm max-w-none mb-4">
                      <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                        {advice.body}
                      </p>
                    </div>

                    {/* Commitments */}
                    {commitments && commitments.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-muted-foreground">Zusagen für den nächsten Monat</h4>
                        <div className="space-y-2">
                          {commitments.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                            >
                              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                <ArrowRight className="h-3 w-3 text-primary" />
                              </div>
                              <span className="text-sm">{c.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
