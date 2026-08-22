import { db } from './index.js';
import { snapshots, reminders, moduleSettings } from '@finanz/db/schema';
import { eq, and } from 'drizzle-orm';

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousPeriod(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;

  if (!chatId) {
    // Fall back to the paired chat from module settings (same contract as the bot)
    const row = await db.query.moduleSettings.findFirst({
      where: eq(moduleSettings.moduleId, 'telegram'),
    });
    const config = row?.config as { chatId?: number | null } | undefined;
    if (config?.chatId != null) {
      chatId = String(config.chatId);
    }
  }

  if (!token || !chatId) {
    console.log('Telegram not configured, skipping notification');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to send Telegram message:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram send error:', error);
    return false;
  }
}

export async function checkAndSendReminder(stage: number): Promise<void> {
  // For stage 3, we're checking the previous month
  const period = stage === 3 ? getPreviousPeriod() : getCurrentPeriod();

  // Check if snapshot exists and is complete
  const snapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.period, period),
  });

  if (snapshot?.status === 'complete') {
    console.log(`Snapshot for ${period} already complete, skipping reminder`);
    return;
  }

  // Check if reminder already sent (idempotency)
  const existingReminder = await db.query.reminders.findFirst({
    where: and(eq(reminders.period, period), eq(reminders.stage, stage)),
  });

  if (existingReminder) {
    console.log(`Reminder stage ${stage} for ${period} already sent, skipping`);
    return;
  }

  // Compose message based on stage
  let message: string;

  switch (stage) {
    case 1:
      message =
        '📊 <b>Zeit für den Monatsabschluss!</b>\n\n' +
        'Erfasse jetzt deinen Vermögensstand für diesen Monat.\n\n' +
        'Tippe /stand um zu beginnen.';
      break;
    case 2:
      message =
        '⏰ <b>Letzter Tag des Monats!</b>\n\n' +
        'Der Monatsabschluss steht noch aus. ' +
        'Nimm dir 2 Minuten und halte deinen Stand fest.\n\n' +
        '/stand';
      break;
    case 3:
      message =
        '⚠️ <b>Letzte Chance für den Monatsabschluss!</b>\n\n' +
        'Ohne Eintrag fehlt dieser Monat dauerhaft in deiner Vermögenskurve.\n\n' +
        '/stand';
      break;
    default:
      return;
  }

  const sent = await sendTelegramMessage(message);

  if (sent) {
    // Record that we sent the reminder
    await db.insert(reminders).values({
      period,
      stage,
      channel: 'telegram',
    });
    console.log(`Reminder stage ${stage} for ${period} sent successfully`);
  }
}
