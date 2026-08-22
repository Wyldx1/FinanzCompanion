import { NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { requireAuthApi } from '@/lib/auth';
import { db } from '@/lib/db';
import { moduleSettings } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';

interface TelegramConfig {
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  chatId: number | null;
}

export async function POST() {
  const session = await requireAuthApi();
  if (session instanceof NextResponse) return session;

  try {
    // 6-digit pairing code, valid for 10 minutes
    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const pairingExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const existing = await db.query.moduleSettings.findFirst({
      where: eq(moduleSettings.moduleId, 'telegram'),
    });
    const previous = (existing?.config ?? {}) as Partial<TelegramConfig>;

    const config: TelegramConfig = {
      pairingCode: code,
      pairingExpiresAt,
      chatId: previous.chatId ?? null,
    };

    if (existing) {
      await db
        .update(moduleSettings)
        .set({ enabled: true, config, updatedAt: new Date() })
        .where(eq(moduleSettings.moduleId, 'telegram'));
    } else {
      await db.insert(moduleSettings).values({
        moduleId: 'telegram',
        enabled: true,
        config,
      });
    }

    return NextResponse.json({ code });
  } catch (error) {
    console.error('Telegram code error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Interner Fehler' } },
      { status: 500 }
    );
  }
}
