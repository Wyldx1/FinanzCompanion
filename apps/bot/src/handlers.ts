import { Context, SessionFlavor } from 'grammy';
import { db } from './index.js';
import {
  accounts,
  snapshots,
  snapshotBalances,
  transactions,
  categories,
} from '@finanz/db/schema';
import { eq, isNull, and, gte, lt, desc } from 'drizzle-orm';
import { parseExpense } from './parser.js';

interface SessionData {
  step?: string;
  snapshotPeriod?: string;
  snapshotBalances?: Record<number, number>;
  snapshotIncome?: number;
  currentAccountIndex?: number;
  lastTransactionId?: number;
}

type BotContext = Context & SessionFlavor<SessionData>;

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}

export async function handleStand(ctx: BotContext) {
  const period = getCurrentPeriod();
  const activeAccounts = await db.query.accounts.findMany({
    where: isNull(accounts.archivedAt),
    orderBy: [accounts.sortOrder],
  });

  if (activeAccounts.length === 0) {
    await ctx.reply('❌ Keine Konten vorhanden. Erstelle zuerst Konten in der Web-App.');
    return;
  }

  // Get previous balances
  const prevPeriod = getPreviousPeriod(period);
  const prevSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.period, prevPeriod),
    with: { balances: true },
  });

  const prevBalances: Record<number, number> = {};
  if (prevSnapshot) {
    for (const b of prevSnapshot.balances) {
      prevBalances[b.accountId] = b.balanceCents;
    }
  }

  ctx.session.step = 'snapshot';
  ctx.session.snapshotPeriod = period;
  ctx.session.snapshotBalances = {};
  ctx.session.currentAccountIndex = 0;

  const firstAccount = activeAccounts[0];
  const prevValue = prevBalances[firstAccount.id] || 0;

  await ctx.reply(
    `📊 Monatsabschluss ${formatPeriod(period)}. ${activeAccounts.length} Konten.\n\n` +
      `${firstAccount.icon || '💰'} ${firstAccount.name}\n` +
      `Letzter Stand: ${formatCurrency(prevValue)}\n\n` +
      `Gib den aktuellen Stand ein oder "=" für unverändert:`
  );
}

export async function handleText(ctx: BotContext) {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  // Check if in snapshot dialog
  if (ctx.session.step === 'snapshot') {
    await handleSnapshotInput(ctx, text);
    return;
  }

  if (ctx.session.step === 'snapshot_income') {
    await handleIncomeInput(ctx, text);
    return;
  }

  if (ctx.session.step === 'snapshot_note') {
    await handleNoteInput(ctx, text);
    return;
  }

  // Otherwise, try to parse as expense
  await handleExpenseInput(ctx, text);
}

async function handleSnapshotInput(ctx: BotContext, text: string) {
  const period = ctx.session.snapshotPeriod!;
  const index = ctx.session.currentAccountIndex!;

  const activeAccounts = await db.query.accounts.findMany({
    where: isNull(accounts.archivedAt),
    orderBy: [accounts.sortOrder],
  });

  const currentAccount = activeAccounts[index];
  if (!currentAccount) return;

  // Get previous balance
  const prevPeriod = getPreviousPeriod(period);
  const prevSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.period, prevPeriod),
    with: { balances: true },
  });
  const prevBalance =
    prevSnapshot?.balances.find((b) => b.accountId === currentAccount.id)?.balanceCents || 0;

  let balanceCents: number;

  if (text === '=') {
    balanceCents = prevBalance;
  } else {
    const parsed = parseCurrency(text);
    if (parsed === null) {
      await ctx.reply('❌ Ungültiger Betrag. Beispiel: 1234,56 oder 1.2k');
      return;
    }
    balanceCents = parsed;
  }

  ctx.session.snapshotBalances![currentAccount.id] = balanceCents;

  // Move to next account or income
  if (index + 1 < activeAccounts.length) {
    ctx.session.currentAccountIndex = index + 1;
    const nextAccount = activeAccounts[index + 1];
    const nextPrevBalance =
      prevSnapshot?.balances.find((b) => b.accountId === nextAccount.id)?.balanceCents || 0;

    await ctx.reply(
      `✓ ${nextAccount.icon || '💰'} ${nextAccount.name}\n` +
        `Letzter Stand: ${formatCurrency(nextPrevBalance)}`
    );
  } else {
    ctx.session.step = 'snapshot_income';
    await ctx.reply('✓ Alle Konten erfasst.\n\nNettoeinkommen im Monat?');
  }
}

async function handleIncomeInput(ctx: BotContext, text: string) {
  const parsed = parseCurrency(text);
  if (parsed === null) {
    await ctx.reply('❌ Ungültiger Betrag.');
    return;
  }

  ctx.session.snapshotIncome = parsed;
  ctx.session.step = 'snapshot_note';
  await ctx.reply('Kurze Notiz zum Monat? (oder "-" für keine)');
}

async function handleNoteInput(ctx: BotContext, text: string) {
  const note = text === '-' ? null : text;
  const period = ctx.session.snapshotPeriod!;
  const balances = ctx.session.snapshotBalances!;
  const income = ctx.session.snapshotIncome || 0;

  // Save snapshot
  const existing = await db.query.snapshots.findFirst({
    where: eq(snapshots.period, period),
  });

  let snapshotId: number;

  if (existing) {
    const [updated] = await db
      .update(snapshots)
      .set({
        incomeCents: income,
        note,
        status: 'complete',
        recordedAt: new Date(),
      })
      .where(eq(snapshots.id, existing.id))
      .returning();
    snapshotId = updated.id;
    await db.delete(snapshotBalances).where(eq(snapshotBalances.snapshotId, snapshotId));
  } else {
    const [created] = await db
      .insert(snapshots)
      .values({
        period,
        incomeCents: income,
        note,
        status: 'complete',
        recordedAt: new Date(),
      })
      .returning();
    snapshotId = created.id;
  }

  // Insert balances
  const balanceEntries = Object.entries(balances).map(([accountId, cents]) => ({
    snapshotId,
    accountId: parseInt(accountId),
    balanceCents: cents as number,
  }));

  if (balanceEntries.length > 0) {
    await db.insert(snapshotBalances).values(balanceEntries);
  }

  // Calculate summary
  let networth = 0;
  const allAccounts = await db.query.accounts.findMany();
  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));

  for (const [accountId, cents] of Object.entries(balances)) {
    const account = accountMap.get(parseInt(accountId));
    if (!account || !account.includeInNetworth) continue;
    if (account.kind === 'liability') {
      networth -= cents as number;
    } else {
      networth += cents as number;
    }
  }

  // Clear session
  ctx.session = {};

  await ctx.reply(
    '━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ Monatsabschluss ${formatPeriod(period)} gespeichert!\n\n` +
      `Nettovermögen: ${formatCurrency(networth)}\n` +
      '━━━━━━━━━━━━━━━━━━━━'
  );
}

async function handleExpenseInput(ctx: BotContext, text: string) {
  const result = await parseExpense(text);

  if (!result) {
    await ctx.reply(
      '❓ Konnte ich nicht verarbeiten.\n' +
        'Format: 12,50 Rewe\n' +
        'Oder: 60 tanken'
    );
    return;
  }

  // Find category
  let categoryId: number | null = null;
  if (result.category) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.name, result.category),
    });
    categoryId = cat?.id || null;
  }

  // Get default account
  const defaultAccount = await db.query.accounts.findFirst({
    where: and(isNull(accounts.archivedAt), eq(accounts.isDefaultPayment, true)),
  });

  // Insert transaction
  const [tx] = await db
    .insert(transactions)
    .values({
      occurredOn: result.date,
      amountCents: result.amountCents,
      direction: 'expense',
      categoryId,
      accountId: defaultAccount?.id || null,
      merchant: result.merchant,
      note: result.note,
      source: 'telegram',
      rawInput: text,
      confidence: result.confidence,
      confirmed: result.confidence >= 0.85,
    })
    .returning();

  ctx.session.lastTransactionId = tx.id;

  const cat = categoryId
    ? await db.query.categories.findFirst({ where: eq(categories.id, categoryId) })
    : null;

  const icon = cat?.icon || '❓';
  const catName = cat?.name || 'Sonstiges';

  if (result.confidence >= 0.85) {
    await ctx.reply(
      `✓ ${formatCurrency(result.amountCents)} · ${icon} ${catName}` +
        (result.merchant ? ` · ${result.merchant}` : '')
    );
  } else {
    await ctx.reply(
      `📝 ${formatCurrency(result.amountCents)} · ${icon} ${catName}` +
        (result.merchant ? ` · ${result.merchant}` : '') +
        '\n\n⚠️ Nicht sicher. Stimmt die Kategorie?'
    );
  }
}

export async function handleToday(ctx: BotContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysTx = await db.query.transactions.findMany({
    where: and(
      eq(transactions.direction, 'expense'),
      gte(transactions.occurredOn, today),
      lt(transactions.occurredOn, tomorrow)
    ),
    with: { category: true },
    orderBy: [desc(transactions.createdAt)],
  });

  if (todaysTx.length === 0) {
    await ctx.reply('📊 Heute noch keine Ausgaben erfasst.');
    return;
  }

  const total = todaysTx.reduce((sum, tx) => sum + tx.amountCents, 0);
  const lines = todaysTx.map((tx) => {
    const icon = tx.category?.icon || '❓';
    return `${icon} ${formatCurrency(tx.amountCents)} ${tx.merchant || tx.category?.name || ''}`;
  });

  await ctx.reply(
    `📊 Heute: ${formatCurrency(total)}\n\n` + lines.join('\n')
  );
}

export async function handleMonth(ctx: BotContext) {
  const period = getCurrentPeriod();
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const monthTx = await db.query.transactions.findMany({
    where: and(
      eq(transactions.direction, 'expense'),
      gte(transactions.occurredOn, startDate),
      lt(transactions.occurredOn, endDate)
    ),
  });

  const tracked = monthTx.reduce((sum, tx) => sum + tx.amountCents, 0);

  await ctx.reply(
    `📊 ${formatPeriod(period)}\n\n` +
      `Erfasst: ${formatCurrency(tracked)}\n` +
      `Transaktionen: ${monthTx.length}`
  );
}

export async function handleUndo(ctx: BotContext) {
  const lastId = ctx.session.lastTransactionId;

  if (!lastId) {
    await ctx.reply('❌ Keine letzte Transaktion zum Rückgängigmachen.');
    return;
  }

  const deleted = await db
    .delete(transactions)
    .where(eq(transactions.id, lastId))
    .returning({ id: transactions.id });
  ctx.session.lastTransactionId = undefined;

  if (deleted.length === 0) {
    await ctx.reply('❌ Bereits gelöscht oder nicht mehr vorhanden.');
    return;
  }

  await ctx.reply('✓ Letzte Transaktion gelöscht.');
}

// Helpers
function getPreviousPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
}

function parseCurrency(value: string): number | null {
  let cleaned = value.trim().toLowerCase();

  if (cleaned.endsWith('k')) {
    cleaned = cleaned.slice(0, -1);
    const num = parseFloat(cleaned.replace(',', '.'));
    if (isNaN(num)) return null;
    return Math.round(num * 1000 * 100);
  }

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  cleaned = cleaned.replace(/[€\s]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}
