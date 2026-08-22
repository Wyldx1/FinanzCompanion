import 'dotenv/config';
import { Bot, webhookCallback, session, Context, SessionFlavor, StorageAdapter } from 'grammy';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@finanz/db/schema';
import { botSessions, moduleSettings } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';
import { handleStand, handleText, handleToday, handleMonth, handleUndo } from './handlers.js';
import { createServer } from 'http';

// Session data interface
interface SessionData {
  step?: string;
  snapshotPeriod?: string;
  snapshotBalances?: Record<number, number>;
  snapshotIncome?: number;
  currentAccountIndex?: number;
  lastTransactionId?: number;
}

type BotContext = Context & SessionFlavor<SessionData>;

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Bot instance
const bot = new Bot<BotContext>(process.env.TELEGRAM_BOT_TOKEN!);

// Allowed chat ID
const ALLOWED_CHAT_ID = process.env.TELEGRAM_ALLOWED_CHAT_ID
  ? BigInt(process.env.TELEGRAM_ALLOWED_CHAT_ID)
  : null;

// Session middleware backed by the bot_sessions table (survives restarts)
const sessionStorage: StorageAdapter<SessionData> = {
  async read(key) {
    const chatId = Number(key);
    if (!Number.isFinite(chatId)) return undefined;
    const row = await db.query.botSessions.findFirst({
      where: eq(botSessions.chatId, chatId),
    });
    return (row?.state as SessionData | undefined) ?? undefined;
  },
  async write(key, value) {
    const chatId = Number(key);
    await db
      .insert(botSessions)
      .values({ chatId, state: value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: botSessions.chatId,
        set: { state: value, updatedAt: new Date() },
      });
  },
  async delete(key) {
    await db.delete(botSessions).where(eq(botSessions.chatId, Number(key)));
  },
};

bot.use(
  session({
    initial: (): SessionData => ({}),
    storage: sessionStorage,
  })
);

// Telegram module settings (pairing contract shared with the web app)
interface TelegramModuleConfig {
  pairingCode: string | null;
  pairingExpiresAt: string | null;
  chatId: number | null;
}

let cachedConfig: TelegramModuleConfig | null = null;
let cacheTimestamp = 0;
const CONFIG_CACHE_TTL_MS = 60_000;

async function getTelegramConfig(forceRefresh = false): Promise<TelegramModuleConfig | null> {
  const now = Date.now();
  if (!forceRefresh && now - cacheTimestamp < CONFIG_CACHE_TTL_MS) {
    return cachedConfig;
  }
  try {
    const row = await db.query.moduleSettings.findFirst({
      where: eq(moduleSettings.moduleId, 'telegram'),
    });
    cachedConfig = (row?.config as TelegramModuleConfig | undefined) ?? null;
    cacheTimestamp = now;
  } catch (e) {
    console.error('Failed to read telegram module settings:', e);
  }
  return cachedConfig;
}

// Auth middleware - silently ignore unauthorized users
bot.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // (a) static env allowlist
  if (ALLOWED_CHAT_ID !== null && BigInt(chatId) === ALLOWED_CHAT_ID) {
    await next();
    return;
  }

  // (b) paired chat from module settings
  const config = await getTelegramConfig();
  if (config?.chatId != null && config.chatId === chatId) {
    await next();
    return;
  }

  // Nothing configured at all: allow only /start so pairing can happen
  if (ALLOWED_CHAT_ID === null && config?.chatId == null) {
    if (ctx.message?.text?.startsWith('/start')) {
      await next();
    }
  }
  // Silently ignore unauthorized users
});

// Commands
bot.command('start', async (ctx) => {
  const pairingMatch = ctx.message?.text?.match(/^\/start\s+(\d{6})\s*$/);

  if (pairingMatch) {
    const code = pairingMatch[1];
    const config = await getTelegramConfig(true);
    const expiresAt = config?.pairingExpiresAt ? new Date(config.pairingExpiresAt) : null;

    if (config?.pairingCode === code && expiresAt && expiresAt.getTime() > Date.now()) {
      const newConfig: TelegramModuleConfig = {
        pairingCode: null,
        pairingExpiresAt: null,
        chatId: ctx.chat.id,
      };
      await db
        .update(moduleSettings)
        .set({ config: newConfig, updatedAt: new Date() })
        .where(eq(moduleSettings.moduleId, 'telegram'));
      cachedConfig = newConfig;
      cacheTimestamp = Date.now();
      await ctx.reply('✓ Verknüpft! Dieser Chat ist jetzt mit dem Finanz-Companion verbunden.');
      return;
    }
    // Wrong or expired code: silently ignore (don't confirm the bot exists)
    return;
  }

  await ctx.reply(
    '👋 Willkommen beim Finanz-Companion!\n\n' +
      'Verfügbare Befehle:\n' +
      '/stand - Monatsabschluss erfassen\n' +
      '/heute - Ausgaben von heute\n' +
      '/monat - Monatszwischenstand\n' +
      '/undo - Letzte Eingabe rückgängig\n' +
      '/hilfe - Diese Hilfe anzeigen\n\n' +
      'Oder schreib einfach deine Ausgaben:\n' +
      '14,80 Rewe\n' +
      '60 tanken'
  );
});

bot.command('hilfe', async (ctx) => {
  await ctx.reply(
    '📊 Finanz-Companion Befehle:\n\n' +
      '/stand - Monatsabschluss erfassen\n' +
      '/heute - Ausgaben von heute\n' +
      '/monat - Monatszwischenstand\n' +
      '/undo - Letzte Eingabe rückgängig\n\n' +
      'Schnellerfassung:\n' +
      '14,80 Rewe → Lebensmittel\n' +
      '60 tanken → Tanken\n' +
      '25 döner mit Max → Restaurant\n\n' +
      'Tipps:\n' +
      '• Beträge: 14,80 oder 14.80 oder 1,2k\n' +
      '• Datum: "gestern 12 döner"'
  );
});

bot.command('stand', handleStand);
bot.command('heute', handleToday);
bot.command('monat', handleMonth);
bot.command('undo', handleUndo);
bot.command('abbruch', async (ctx) => {
  ctx.session = {};
  await ctx.reply('❌ Abgebrochen.');
});

// Handle free text messages
bot.on('message:text', handleText);

// Error handler
bot.catch((err) => {
  console.error('Bot error:', err);
});

// Start the bot
const PORT = parseInt(process.env.PORT || '3001', 10);
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Register command list with Telegram (autocomplete), fire-and-forget
function registerCommands(): void {
  bot.api
    .setMyCommands([
      { command: 'stand', description: 'Monatsabschluss erfassen' },
      { command: 'heute', description: 'Ausgaben von heute' },
      { command: 'monat', description: 'Monatszwischenstand' },
      { command: 'undo', description: 'Letzte Eingabe rückgängig' },
      { command: 'abbruch', description: 'Aktuellen Dialog abbrechen' },
      { command: 'hilfe', description: 'Hilfe anzeigen' },
    ])
    .catch(console.error);
}

if (process.env.NODE_ENV === 'production' && WEBHOOK_SECRET) {
  // Webhook mode for production
  const handleUpdate = webhookCallback(bot, 'http', {
    secretToken: WEBHOOK_SECRET,
  });

  const server = createServer(async (req, res) => {
    if (req.url === '/telegram/webhook' && req.method === 'POST') {
      try {
        await handleUpdate(req, res);
      } catch (e) {
        console.error('Webhook error:', e);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    } else if (req.url === '/health') {
      res.statusCode = 200;
      res.end('OK');
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  server.listen(PORT, () => {
    console.log(`Bot webhook server running on port ${PORT}`);
  });
  registerCommands();
} else {
  // Long polling for development
  registerCommands();
  bot.start({
    onStart: () => {
      console.log('Bot started in polling mode');
    },
  });
}
