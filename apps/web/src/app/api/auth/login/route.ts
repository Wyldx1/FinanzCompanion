import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSession } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  passphrase: z.string().min(1),
});

// Simple rate limiting (counts failed attempts only)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  return !!record && record.resetAt > now && record.count >= MAX_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = attempts.get(ip);

  if (!record || record.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  record.count++;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: 'Zu viele Versuche. Bitte warte 15 Minuten.' } },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { passphrase } = loginSchema.parse(body);

    const userId = await verifyPassword(passphrase);

    if (!userId) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Falsche Passphrase' } },
        { status: 401 }
      );
    }

    attempts.delete(ip);
    await createSession(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Ungültige Eingabe' } },
        { status: 400 }
      );
    }

    console.error('Login error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
