import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { db } from '@/lib/db';
import { adviceLog, snapshots } from '@finanz/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getCurrentPeriod } from '@/lib/utils';
import { calculateMetrics } from '@/lib/calculations';

export async function GET() {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;

  const logs = await db.query.adviceLog.findMany({
    orderBy: [desc(adviceLog.createdAt)],
    limit: 12,
  });

  return NextResponse.json(logs);
}

export async function POST(request: NextRequest) {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { period = getCurrentPeriod() } = body;

    // Check if snapshot exists for this period
    const snapshot = await db.query.snapshots.findFirst({
      where: eq(snapshots.period, period),
    });

    if (!snapshot || snapshot.status !== 'complete') {
      return NextResponse.json(
        { error: { code: 'NO_SNAPSHOT', message: 'Kein abgeschlossener Snapshot für diesen Monat' } },
        { status: 400 }
      );
    }

    // Calculate metrics for coaching
    const metrics = await calculateMetrics(period);
    if (!metrics) {
      return NextResponse.json(
        { error: { code: 'NO_METRICS', message: 'Keine Daten verfügbar' } },
        { status: 400 }
      );
    }

    // Generate coaching advice using Claude API (placeholder for now)
    // In production, this would call the Anthropic API
    const coachingResponse = generateCoachingAdvice(metrics, snapshot);

    // Save to database
    const [created] = await db
      .insert(adviceLog)
      .values({
        period,
        trigger: 'on_demand',
        model: 'claude-3-haiku-20240307',
        metricsJson: metrics,
        verdict: coachingResponse.verdict,
        body: coachingResponse.body,
        commitments: coachingResponse.commitments,
        inputTokens: 0,
        outputTokens: 0,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Coach API error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}

// Placeholder function - in production this would call Claude API
function generateCoachingAdvice(metrics: any, snapshot: any) {
  const savingsRate = metrics.savingsRate ?? 0;
  const networthChange = metrics.networthChangeCents ?? 0;

  let verdict = '';
  let body = '';
  const commitments: { id: string; text: string }[] = [];

  if (savingsRate >= 0.2) {
    verdict = 'Ausgezeichnete Sparleistung! 🌟';
    body = `Du hast diesen Monat eine Sparquote von ${Math.round(savingsRate * 100)}% erreicht. Das ist hervorragend! `;
    body += `Dein Nettovermögen hat sich um ${(networthChange / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} verändert.\n\n`;
    body += `Weiter so! Mit dieser Sparquote baust du dir ein solides finanzielles Polster auf.`;

    commitments.push({ id: '1', text: 'Nächsten Monat die Sparquote halten oder verbessern' });
  } else if (savingsRate >= 0.1) {
    verdict = 'Solide Sparleistung! 👍';
    body = `Eine Sparquote von ${Math.round(savingsRate * 100)}% ist ein guter Anfang. `;
    body += `Versuche, schrittweise auf 20% zu kommen - das ist ein gesundes Ziel für langfristigen Vermögensaufbau.\n\n`;
    body += `Tipp: Schau dir deine größten Ausgabenkategorien an und überlege, wo du optimieren kannst.`;

    commitments.push({ id: '1', text: 'Ausgaben in einer Kategorie um 10% reduzieren' });
    commitments.push({ id: '2', text: 'Einen automatischen Sparplan einrichten' });
  } else if (savingsRate >= 0) {
    verdict = 'Raum für Verbesserung 📈';
    body = `Deine Sparquote von ${Math.round(savingsRate * 100)}% zeigt, dass du knapp über null liegst. `;
    body += `Das ist besser als Schulden zu machen, aber es gibt Potenzial nach oben.\n\n`;
    body += `Empfehlung: Erstelle ein Budget und identifiziere 2-3 Bereiche, wo du Ausgaben reduzieren kannst.`;

    commitments.push({ id: '1', text: 'Ein monatliches Budget erstellen' });
    commitments.push({ id: '2', text: 'Mindestens 5% nächsten Monat sparen' });
  } else {
    verdict = 'Achtung: Negativer Cashflow ⚠️';
    body = `Diesen Monat hast du mehr ausgegeben als eingenommen. Das kann mal passieren, sollte aber nicht zur Gewohnheit werden.\n\n`;
    body += `Wichtig: Analysiere, ob es einmalige Ausgaben waren oder ob du dein Ausgabeverhalten anpassen musst.`;

    commitments.push({ id: '1', text: 'Alle Abonnements überprüfen' });
    commitments.push({ id: '2', text: 'Nächsten Monat positiven Cashflow erreichen' });
  }

  if (snapshot.note) {
    body += `\n\nDeine Notiz: "${snapshot.note}" - Das nehme ich für die Analyse zur Kenntnis.`;
  }

  return { verdict, body, commitments };
}
