import { Context, SessionFlavor } from 'grammy';
import { db } from './index.js';
import {
  accounts,
  snapshots,
  snapshotBalances,
  transactions,
  categories,
  workTimeEntries,
  vehicles,
  fuelEntries,
  weightEntries,
} from '@finanz/db/schema';
import { eq, isNull, and, gte, lte, lt, desc, sql, asc } from 'drizzle-orm';
import { parseTransaction } from './parser.js';
import { calculateWorkTime } from '@finanz/db/soka';

interface WorkTimeSession {
  date?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  site?: string;
}

interface FuelSession {
  vehicleId?: number;
  date?: string;
  odometerKm?: number;
  quantity?: number;
  pricePerUnitCents?: number;
}

interface WeightSession {
  date?: string;
  weightKg?: number;
}

interface TransactionSession {
  amountCents?: number;
  accountId?: number;
  date?: string;
}

interface IncomeSession {
  amountCents?: number;
  type?: string;
  date?: string;
}

interface SessionData {
  step?: string;
  snapshotPeriod?: string;
  snapshotBalances?: Record<number, number>;
  snapshotIncome?: number;
  currentAccountIndex?: number;
  lastTransactionId?: number;
  workTime?: WorkTimeSession;
  fuel?: FuelSession;
  weight?: WeightSession;
  tx?: TransactionSession;
  income?: IncomeSession;
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

async function getProjectedAccountBalance(accountId: number): Promise<number | null> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const currentPeriod = `${year}-${month}`;

  const lastSnapshot = await db.query.snapshots.findFirst({
    where: and(eq(snapshots.status, 'complete'), lt(snapshots.period, currentPeriod)),
    orderBy: [desc(snapshots.period)],
    with: { balances: true },
  });

  if (!lastSnapshot) return null;

  const balance = lastSnapshot.balances.find((b) => b.accountId === accountId);
  const base = balance?.balanceCents || 0;

  const [yearSnap, monthSnap] = lastSnapshot.period.split('-').map(Number);
  const transactionStart = new Date(yearSnap, monthSnap, 1);

  const [outgoing, incoming] = await Promise.all([
    db
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'income' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'expense' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.direction} = 'transfer' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          gte(transactions.occurredOn, transactionStart),
          lte(transactions.occurredOn, now)
        )
      ),
    db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.targetAccountId, accountId),
          gte(transactions.occurredOn, transactionStart),
          lte(transactions.occurredOn, now)
        )
      ),
  ]);

  const income = Number(outgoing[0]?.income) || 0;
  const expense = Number(outgoing[0]?.expense) || 0;
  const transferOut = Number(outgoing[0]?.transferOut) || 0;
  const transferIn = Number(incoming[0]?.total) || 0;

  return base + income - expense - transferOut + transferIn;
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
  const projectedFirst = await getProjectedAccountBalance(firstAccount.id);

  let firstMessage =
    `📊 Monatsabschluss ${formatPeriod(period)}. ${activeAccounts.length} Konten.\n\n` +
    `${firstAccount.icon || '💰'} ${firstAccount.name}\n` +
    `Letzter Stand: ${formatCurrency(prevValue)}`;
  if (projectedFirst !== null) {
    firstMessage += `\nLaut Transaktionen erwartet: ${formatCurrency(projectedFirst)}`;
  }
  firstMessage += '\n\nGib den aktuellen Stand ein oder "=" für unverändert:';

  await ctx.reply(firstMessage);
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

  // Work time dialog steps
  if (ctx.session.step === 'worktime_date_input') {
    await handleWorkTimeDateInput(ctx, text);
    return;
  }

  if (ctx.session.step === 'worktime_start') {
    await handleWorkTimeStart(ctx, text);
    return;
  }

  if (ctx.session.step === 'worktime_end') {
    await handleWorkTimeEnd(ctx, text);
    return;
  }

  if (ctx.session.step === 'worktime_break') {
    await handleWorkTimeBreak(ctx, text);
    return;
  }

  if (ctx.session.step === 'worktime_site') {
    await handleWorkTimeSite(ctx, text);
    return;
  }

  if (ctx.session.step === 'worktime_notes') {
    await handleWorkTimeNotes(ctx, text);
    return;
  }

  // Fuel dialog steps
  if (ctx.session.step === 'fuel_date_input') {
    await handleFuelDateInput(ctx, text);
    return;
  }

  if (ctx.session.step === 'fuel_odometer') {
    await handleFuelOdometer(ctx, text);
    return;
  }

  if (ctx.session.step === 'fuel_quantity') {
    await handleFuelQuantity(ctx, text);
    return;
  }

  if (ctx.session.step === 'fuel_price') {
    await handleFuelPrice(ctx, text);
    return;
  }

  if (ctx.session.step === 'fuel_notes') {
    await handleFuelNotes(ctx, text);
    return;
  }

  // Weight dialog steps
  if (ctx.session.step === 'weight_date_input') {
    await handleWeightDateInput(ctx, text);
    return;
  }

  if (ctx.session.step === 'weight_value') {
    await handleWeightValue(ctx, text);
    return;
  }

  if (ctx.session.step === 'weight_notes') {
    await handleWeightNotes(ctx, text);
    return;
  }

  // Transaction dialog steps
  if (ctx.session.step === 'tx_amount') {
    await handleTxAmount(ctx, text);
    return;
  }

  if (ctx.session.step === 'tx_date_input') {
    await handleTxDateInput(ctx, text);
    return;
  }

  if (ctx.session.step === 'tx_description') {
    await handleTxDescription(ctx, text);
    return;
  }

  // Income dialog steps
  if (ctx.session.step === 'income_amount') {
    await handleIncomeAmount(ctx, text);
    return;
  }

  if (ctx.session.step === 'income_date_input') {
    await handleIncomeDateInput(ctx, text);
    return;
  }

  if (ctx.session.step === 'income_note') {
    await handleIncomeNote(ctx, text);
    return;
  }

  // Otherwise, try to parse as transaction
  await handleTransactionInput(ctx, text);
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
    const nextProjected = await getProjectedAccountBalance(nextAccount.id);

    let message = `✓ ${nextAccount.icon || '💰'} ${nextAccount.name}\n` +
      `Letzter Stand: ${formatCurrency(nextPrevBalance)}`;
    if (nextProjected !== null) {
      message += `\nLaut Transaktionen erwartet: ${formatCurrency(nextProjected)}`;
    }

    await ctx.reply(message);
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

async function handleTransactionInput(ctx: BotContext, text: string) {
  const result = await parseTransaction(text);

  if (!result) {
    await ctx.reply(
      '❓ Konnte ich nicht verarbeiten.\n' +
        'Format: 12,50 Rewe\n' +
        'Oder: +3000 Gehalt\n' +
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
      direction: result.direction,
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
  const directionIcon = result.direction === 'income' ? '➕' : result.direction === 'expense' ? '➖' : '↔️';

  if (result.confidence >= 0.85) {
    await ctx.reply(
      `${directionIcon} ${formatCurrency(result.amountCents)} · ${icon} ${catName}` +
        (result.merchant ? ` · ${result.merchant}` : '')
    );
  } else {
    await ctx.reply(
      `📝 ${directionIcon} ${formatCurrency(result.amountCents)} · ${icon} ${catName}` +
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
      gte(transactions.occurredOn, today),
      lt(transactions.occurredOn, tomorrow)
    ),
    with: { category: true },
    orderBy: [desc(transactions.createdAt)],
  });

  if (todaysTx.length === 0) {
    await ctx.reply('📊 Heute noch keine Transaktionen erfasst.');
    return;
  }

  const income = todaysTx
    .filter((tx) => tx.direction === 'income')
    .reduce((sum, tx) => sum + tx.amountCents, 0);
  const expense = todaysTx
    .filter((tx) => tx.direction === 'expense')
    .reduce((sum, tx) => sum + tx.amountCents, 0);
  const lines = todaysTx.map((tx) => {
    const icon = tx.category?.icon || '❓';
    const dirIcon = tx.direction === 'income' ? '➕' : tx.direction === 'expense' ? '➖' : '↔️';
    return `${dirIcon} ${icon} ${formatCurrency(tx.amountCents)} ${tx.merchant || tx.category?.name || ''}`;
  });

  await ctx.reply(
    `📊 Heute\n` +
      `Einnahmen: ${formatCurrency(income)}\n` +
      `Ausgaben: ${formatCurrency(expense)}\n` +
      `Saldo: ${formatCurrency(income - expense)}\n\n` +
      lines.join('\n')
  );
}

export async function handleMonth(ctx: BotContext) {
  const period = getCurrentPeriod();
  const [year, month] = period.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const monthTx = await db.query.transactions.findMany({
    where: and(
      gte(transactions.occurredOn, startDate),
      lt(transactions.occurredOn, endDate)
    ),
  });

  const income = monthTx
    .filter((tx) => tx.direction === 'income')
    .reduce((sum, tx) => sum + tx.amountCents, 0);
  const expense = monthTx
    .filter((tx) => tx.direction === 'expense')
    .reduce((sum, tx) => sum + tx.amountCents, 0);

  await ctx.reply(
    `📊 ${formatPeriod(period)}\n\n` +
      `Einnahmen: ${formatCurrency(income)}\n` +
      `Ausgaben: ${formatCurrency(expense)}\n` +
      `Saldo: ${formatCurrency(income - expense)}\n` +
      `Transaktionen: ${monthTx.length}`
  );
}

export async function handleBericht(ctx: BotContext) {
  const today = new Date().toISOString().split('T')[0];
  ctx.session.step = 'worktime_date_choice';
  ctx.session.workTime = {};

  await ctx.reply(
    '🦺 Baustellenbericht\n\n' +
      '📅 Datum?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `📅 Heute (${today})`, callback_data: 'date_choice:today:worktime' },
            { text: '📆 Anderes Datum', callback_data: 'date_choice:custom:worktime' },
          ],
        ],
      },
    }
  );
}

async function handleWorkTimeStart(ctx: BotContext, text: string) {
  const time = parseTime(text) || '07:30';
  ctx.session.workTime = { ...ctx.session.workTime, startTime: time };
  ctx.session.step = 'worktime_end';
  await ctx.reply(`✓ Start: ${time}\n\nEndzeit? (z.B. 16:30)`);
}

async function handleWorkTimeEnd(ctx: BotContext, text: string) {
  const time = parseTime(text);
  if (!time) {
    await ctx.reply('❌ Ungültige Uhrzeit. Bitte im Format HH:MM eingeben, z.B. 16:30');
    return;
  }
  ctx.session.workTime = { ...ctx.session.workTime, endTime: time };
  ctx.session.step = 'worktime_break';
  await ctx.reply(`✓ Ende: ${time}\n\nPause in Minuten? (0 für keine)`);
}

async function handleWorkTimeBreak(ctx: BotContext, text: string) {
  const minutes = parseInt(text.replace(/[^0-9]/g, ''));
  if (isNaN(minutes) || minutes < 0) {
    await ctx.reply('❌ Bitte gib die Pause in Minuten an, z.B. 30');
    return;
  }
  ctx.session.workTime = { ...ctx.session.workTime, breakMinutes: minutes };
  ctx.session.step = 'worktime_site';
  await ctx.reply(`✓ Pause: ${minutes} min\n\nBaustelle / Ort?`);
}

async function handleWorkTimeSite(ctx: BotContext, text: string) {
  ctx.session.workTime = { ...ctx.session.workTime, site: text };
  ctx.session.step = 'worktime_notes';
  await ctx.reply('✓ Baustelle erfasst\n\nWas wurde gemacht? (oder "-")');
}

async function handleWorkTimeNotes(ctx: BotContext, text: string) {
  const wt = ctx.session.workTime;
  if (!wt?.date || !wt.startTime || !wt.endTime) {
    await ctx.reply('❌ Eingabe unvollständig. Starte mit /bericht neu.');
    ctx.session = {};
    return;
  }

  const notes = text === '-' ? null : text;
  const date = new Date(wt.date);
  const breakMinutes = wt.breakMinutes || 0;

  const stats = calculateWorkTime(
    `${wt.startTime}:00`,
    `${wt.endTime}:00`,
    breakMinutes,
    date
  );

  const [created] = await db
    .insert(workTimeEntries)
    .values({
      date,
      startTime: `${wt.startTime}:00`,
      endTime: `${wt.endTime}:00`,
      breakMinutes,
      site: wt.site || null,
      notes,
      netMinutes: stats.netMinutes,
      targetMinutes: stats.targetMinutes,
      overtimeMinutes: stats.overtimeMinutes,
    })
    .returning();

  ctx.session = {};

  await ctx.reply(
    '━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ Baustellenbericht gespeichert\n\n` +
      `📅 ${date.toLocaleDateString('de-DE')}\n` +
      `🕐 ${wt.startTime} – ${wt.endTime}\n` +
      `⏸ Pause: ${breakMinutes} min\n` +
      `🏗 ${wt.site || '-'}\n` +
      `📝 ${notes || '-'}\n\n` +
      `Netto: ${formatMinutes(stats.netMinutes)}\n` +
      `Soll: ${formatMinutes(stats.targetMinutes)}\n` +
      `Überstunden: ${formatMinutes(stats.overtimeMinutes)}\n` +
      '━━━━━━━━━━━━━━━━━━━━'
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? '-' : '';
  return `${sign}${h}:${String(m).padStart(2, '0')} h`;
}

function parseTime(text: string): string | null {
  const cleaned = text.replace(/[^0-9:]/g, '');
  const parts = cleaned.split(':');
  let h = parseInt(parts[0]);
  let m = parts[1] ? parseInt(parts[1]) : 0;

  if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
    return null;
  }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

// =====================================================
// TANKEN
// =====================================================

export async function handleTanken(ctx: BotContext) {
  const allVehicles = await db.query.vehicles.findMany({
    orderBy: [asc(vehicles.sortOrder)],
  });

  if (allVehicles.length === 0) {
    await ctx.reply('❌ Keine Fahrzeuge vorhanden. Lege zuerst Fahrzeuge in der Web-App an.');
    return;
  }

  ctx.session.step = 'fuel_vehicle';
  ctx.session.fuel = {};

  await ctx.reply('⛽ Tankvorgang erfassen\n\nWähle das Fahrzeug:', {
    reply_markup: {
      inline_keyboard: allVehicles.map((v) => [
        {
          text: `${v.type === 'electric' ? '⚡' : '🚗'} ${v.name}`,
          callback_data: `fuel_vehicle:${v.id}`,
        },
      ]),
    },
  });
}

export async function handleCallback(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  // Fuel vehicle selection
  if (data.startsWith('fuel_vehicle:')) {
    await ctx.answerCallbackQuery();
    const vehicleId = parseInt(data.split(':')[1]);
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, vehicleId),
    });

    if (!vehicle) {
      await ctx.reply('❌ Fahrzeug nicht gefunden.');
      ctx.session = {};
      return;
    }

    ctx.session.fuel = { ...ctx.session.fuel, vehicleId };
    ctx.session.step = 'fuel_date_choice';

    const today = new Date().toISOString().split('T')[0];
    await ctx.editMessageText(
      `✓ Fahrzeug: ${vehicle.name}\n\n📅 Datum?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `📅 Heute (${today})`, callback_data: 'date_choice:today:fuel' },
              { text: '📆 Anderes Datum', callback_data: 'date_choice:custom:fuel' },
            ],
          ],
        },
      }
    );
    return;
  }

  // Date choice callbacks
  if (data.startsWith('date_choice:')) {
    await ctx.answerCallbackQuery();
    const [, choice, prefix] = data.split(':');
    const today = new Date().toISOString().split('T')[0];

    if (prefix === 'fuel') {
      if (choice === 'today') {
        ctx.session.fuel = { ...ctx.session.fuel, date: today };
        ctx.session.step = 'fuel_odometer';
        const vehicleId = ctx.session.fuel?.vehicleId;
        const lastEntry = vehicleId
          ? await db.query.fuelEntries.findFirst({
              where: eq(fuelEntries.vehicleId, vehicleId),
              orderBy: [desc(fuelEntries.odometerKm)],
            })
          : null;
        let msg = `✓ Datum: ${today}\n\n🛣 Kilometerstand?`;
        if (lastEntry) msg += ` (Letzter: ${lastEntry.odometerKm} km)`;
        await ctx.editMessageText(msg);
      } else {
        ctx.session.step = 'fuel_date_input';
        await ctx.editMessageText('📆 Datum eingeben (YYYY-MM-DD):');
      }
      return;
    }

    if (prefix === 'weight') {
      if (choice === 'today') {
        ctx.session.weight = { ...ctx.session.weight, date: today };
        ctx.session.step = 'weight_value';
        await ctx.editMessageText(`✓ Datum: ${today}\n\n⚖️ Gewicht in kg?`);
      } else {
        ctx.session.step = 'weight_date_input';
        await ctx.editMessageText('📆 Datum eingeben (YYYY-MM-DD):');
      }
      return;
    }

    if (prefix === 'worktime') {
      if (choice === 'today') {
        ctx.session.workTime = { ...ctx.session.workTime, date: today };
        ctx.session.step = 'worktime_start';
        await ctx.editMessageText(
          `✓ Datum: ${today}\n\n🦺 Baustellenbericht\n\nStartzeit? (Vorschlag 07:30, sende nur eine andere Uhrzeit, z.B. 08:00)`
        );
      } else {
        ctx.session.step = 'worktime_date_input';
        await ctx.editMessageText('📆 Datum eingeben (YYYY-MM-DD):');
      }
      return;
    }

    if (prefix === 'tx') {
      if (choice === 'today') {
        ctx.session.tx = { ...ctx.session.tx, date: today };
        ctx.session.step = 'tx_account';
        const buttons = await buildTxAccountButtons();
        if (buttons.length === 0) {
          await ctx.editMessageText('❌ Kein passendes Konto gefunden. Lege zuerst ein Bargeld- oder Girokonto an.');
          ctx.session = {};
          return;
        }
        await ctx.editMessageText(
          `✓ Datum: ${today}\n\nZahlungsart?`,
          { reply_markup: { inline_keyboard: [buttons] } }
        );
      } else {
        ctx.session.step = 'tx_date_input';
        await ctx.editMessageText('📆 Datum eingeben (YYYY-MM-DD):');
      }
      return;
    }

    if (prefix === 'income') {
      if (choice === 'today') {
        ctx.session.income = { ...ctx.session.income, date: today };
        ctx.session.step = 'income_type';
        const types = [
          { label: '💼 Gehalt', value: 'Gehalt' },
          { label: '👶 Kindergeld', value: 'Kindergeld' },
          { label: '⏰ Überstunden', value: 'Überstunden' },
          { label: '📦 Sonstiges', value: 'Sonstiges' },
        ];
        await ctx.editMessageText(
          `✓ Datum: ${today}\n\nTyp?`,
          {
            reply_markup: {
              inline_keyboard: [types.map((t) => ({ text: t.label, callback_data: `income_type:${t.value}` }))],
            },
          }
        );
      } else {
        ctx.session.step = 'income_date_input';
        await ctx.editMessageText('📆 Datum eingeben (YYYY-MM-DD):');
      }
      return;
    }

    return;
  }

  // Transaction payment method
  if (data.startsWith('tx_account:')) {
    await ctx.answerCallbackQuery();
    const accountId = parseInt(data.split(':')[1]);
    const account = await db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });

    if (!account) {
      await ctx.reply('❌ Konto nicht gefunden.');
      ctx.session = {};
      return;
    }

    ctx.session.tx = { ...ctx.session.tx, accountId };
    ctx.session.step = 'tx_description';

    await ctx.editMessageText(
      `✓ Zahlungsart: ${account.name}\n\n📝 Wofür? (z.B. Rewe, Tanken, Döner)`
    );
    return;
  }

  // Income type
  if (data.startsWith('income_type:')) {
    await ctx.answerCallbackQuery();
    const type = data.split(':')[1];

    ctx.session.income = { ...ctx.session.income, type };
    ctx.session.step = 'income_note';

    await ctx.editMessageText(
      `✓ Typ: ${type}\n\n📝 Notiz? (oder "-")`
    );
    return;
  }
}

async function handleFuelDateInput(ctx: BotContext, text: string) {
  const today = new Date().toISOString().split('T')[0];
  const date = text === '.' ? today : text;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await ctx.reply('❌ Ungültiges Datum. Bitte im Format YYYY-MM-DD eingeben, z.B. 2026-08-23');
    return;
  }

  ctx.session.fuel = { ...ctx.session.fuel, date };
  ctx.session.step = 'fuel_odometer';

  const vehicleId = ctx.session.fuel?.vehicleId;
  const lastEntry = vehicleId
    ? await db.query.fuelEntries.findFirst({
        where: eq(fuelEntries.vehicleId, vehicleId),
        orderBy: [desc(fuelEntries.odometerKm)],
      })
    : null;

  let msg = `✓ Datum: ${date}\n\n🛣 Kilometerstand?`;
  if (lastEntry) {
    msg += ` (Letzter: ${lastEntry.odometerKm} km)`;
  }
  await ctx.reply(msg);
}

async function handleWeightDateInput(ctx: BotContext, text: string) {
  const today = new Date().toISOString().split('T')[0];
  const date = text === '.' ? today : text;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await ctx.reply('❌ Ungültiges Datum. Bitte im Format YYYY-MM-DD eingeben, z.B. 2026-08-23');
    return;
  }

  ctx.session.weight = { ...ctx.session.weight, date };
  ctx.session.step = 'weight_value';

  await ctx.reply(`✓ Datum: ${date}\n\n⚖️ Gewicht in kg?`);
}

async function handleWorkTimeDateInput(ctx: BotContext, text: string) {
  const today = new Date().toISOString().split('T')[0];
  const date = text === '.' ? today : text;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await ctx.reply('❌ Ungültiges Datum. Bitte im Format YYYY-MM-DD eingeben, z.B. 2026-08-23');
    return;
  }

  ctx.session.workTime = { ...ctx.session.workTime, date };
  ctx.session.step = 'worktime_start';

  await ctx.reply(
    `✓ Datum: ${date}\n\n🦺 Baustellenbericht\n\nStartzeit? (Vorschlag 07:30, sende nur eine andere Uhrzeit, z.B. 08:00)`
  );
}

async function handleTxDateInput(ctx: BotContext, text: string) {
  const today = new Date().toISOString().split('T')[0];
  const date = text === '.' ? today : text;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await ctx.reply('❌ Ungültiges Datum. Bitte im Format YYYY-MM-DD eingeben, z.B. 2026-08-23');
    return;
  }

  ctx.session.tx = { ...ctx.session.tx, date };
  ctx.session.step = 'tx_account';

  const buttons = await buildTxAccountButtons();
  if (buttons.length === 0) {
    await ctx.reply('❌ Kein passendes Konto gefunden. Lege zuerst ein Bargeld- oder Girokonto an.');
    ctx.session = {};
    return;
  }

  await ctx.reply(
    `✓ Datum: ${date}\n\nZahlungsart?`,
    { reply_markup: { inline_keyboard: [buttons] } }
  );
}

async function handleFuelOdometer(ctx: BotContext, text: string) {
  const km = parseInt(text.replace(/\D/g, ''));
  if (isNaN(km) || km < 0) {
    await ctx.reply('❌ Bitte einen gültigen Kilometerstand eingeben, z.B. 123456');
    return;
  }

  ctx.session.fuel = { ...ctx.session.fuel, odometerKm: km };
  ctx.session.step = 'fuel_quantity';

  const vehicleId = ctx.session.fuel?.vehicleId;
  const vehicle = vehicleId
    ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, vehicleId) })
    : null;
  const unit = vehicle?.type === 'electric' ? 'kWh' : 'Liter';

  await ctx.reply(`✓ Kilometerstand: ${km} km\n\n⛽ Menge in ${unit}?`);
}

async function handleFuelQuantity(ctx: BotContext, text: string) {
  const quantity = parseGermanDecimal(text);
  if (quantity === null || quantity <= 0) {
    await ctx.reply('❌ Bitte eine gültige Menge eingeben, z.B. 42,5');
    return;
  }

  ctx.session.fuel = { ...ctx.session.fuel, quantity };
  ctx.session.step = 'fuel_price';

  const vehicleId = ctx.session.fuel?.vehicleId;
  const vehicle = vehicleId
    ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, vehicleId) })
    : null;
  const unit = vehicle?.type === 'electric' ? 'kWh' : 'Liter';

  await ctx.reply(`✓ Menge: ${quantity.toFixed(2)} ${unit}\n\n💶 Preis pro ${unit}? (z.B. 2,999)`);
}

async function handleFuelPrice(ctx: BotContext, text: string) {
  const priceCents = parseCurrencyFuel(text);
  if (priceCents === null || priceCents < 0) {
    await ctx.reply('❌ Bitte einen gültigen Preis eingeben, z.B. 2,999');
    return;
  }

  ctx.session.fuel = { ...ctx.session.fuel, pricePerUnitCents: priceCents };
  ctx.session.step = 'fuel_notes';

  await ctx.reply(`✓ Preis: ${(priceCents / 100).toFixed(3)} €\n\n📝 Notiz? (oder "-")`);
}

async function handleFuelNotes(ctx: BotContext, text: string) {
  const fuel = ctx.session.fuel;
  if (!fuel?.vehicleId || !fuel.date || fuel.odometerKm == null || fuel.quantity == null || fuel.pricePerUnitCents == null) {
    await ctx.reply('❌ Eingabe unvollständig. Starte mit /tanken neu.');
    ctx.session = {};
    return;
  }

  const notes = text === '-' ? null : text;
  const totalCents = Math.round(fuel.quantity * fuel.pricePerUnitCents);

  const [created] = await db
    .insert(fuelEntries)
    .values({
      vehicleId: fuel.vehicleId,
      date: new Date(fuel.date),
      odometerKm: fuel.odometerKm,
      quantity: fuel.quantity,
      pricePerUnitCents: fuel.pricePerUnitCents,
      totalCents,
      notes,
    })
    .returning();

  ctx.session = {};

  const vehicle = await db.query.vehicles.findFirst({
    where: eq(vehicles.id, created.vehicleId),
  });

  const unit = vehicle?.type === 'electric' ? 'kWh' : 'Liter';

  await ctx.reply(
    '━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ Tankvorgang gespeichert\n\n` +
      `🚗 ${vehicle?.name || 'Fahrzeug'}\n` +
      `📅 ${new Date(created.date).toLocaleDateString('de-DE')}\n` +
      `🛣 ${created.odometerKm} km\n` +
      `⛽ ${created.quantity.toFixed(2)} ${unit}\n` +
      `💶 ${(created.pricePerUnitCents / 100).toFixed(3)} €/${unit}\n` +
      `💰 ${formatCurrency(created.totalCents)}\n` +
      (created.notes ? `📝 ${created.notes}\n` : '') +
      '━━━━━━━━━━━━━━━━━━━━'
  );
}

// =====================================================
// GEWICHT
// =====================================================

export async function handleGewicht(ctx: BotContext) {
  const today = new Date().toISOString().split('T')[0];
  ctx.session.step = 'weight_date_choice';
  ctx.session.weight = {};

  await ctx.reply(
    '⚖️ Gewicht eintragen\n\n' +
      '📅 Datum?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `📅 Heute (${today})`, callback_data: 'date_choice:today:weight' },
            { text: '📆 Anderes Datum', callback_data: 'date_choice:custom:weight' },
          ],
        ],
      },
    }
  );
}

async function handleWeightValue(ctx: BotContext, text: string) {
  const weightKg = parseGermanDecimal(text.replace(/kg/i, '').trim());
  if (weightKg === null || weightKg <= 0) {
    await ctx.reply('❌ Bitte ein gültiges Gewicht eingeben, z.B. 82,5');
    return;
  }

  ctx.session.weight = { ...ctx.session.weight, weightKg };
  ctx.session.step = 'weight_notes';

  await ctx.reply(`✓ Gewicht: ${weightKg.toFixed(1)} kg\n\n📝 Notiz? (oder "-")`);
}

async function handleWeightNotes(ctx: BotContext, text: string) {
  const weight = ctx.session.weight;
  if (!weight?.date || weight.weightKg == null) {
    await ctx.reply('❌ Eingabe unvollständig. Starte mit /gewicht neu.');
    ctx.session = {};
    return;
  }

  const notes = text === '-' ? null : text;

  const [created] = await db
    .insert(weightEntries)
    .values({
      date: new Date(weight.date),
      weightKg: weight.weightKg,
      notes,
    })
    .returning();

  ctx.session = {};

  await ctx.reply(
    '━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ Gewicht gespeichert\n\n` +
      `📅 ${new Date(created.date).toLocaleDateString('de-DE')}\n` +
      `⚖️ ${created.weightKg.toFixed(1)} kg\n` +
      (created.notes ? `📝 ${created.notes}\n` : '') +
      '━━━━━━━━━━━━━━━━━━━━'
  );
}

// =====================================================
// TRANSAKTION / EINKOMMEN (geführte Dialoge)
// =====================================================

export async function handleTransaktion(ctx: BotContext) {
  ctx.session.step = 'tx_amount';
  ctx.session.tx = {};

  await ctx.reply(
    '💳 Transaktion erfassen\n\n' +
      'Betrag? (z.B. 14,80)'
  );
}

async function buildTxAccountButtons(): Promise<{ text: string; callback_data: string }[]> {
  const cashAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.kind, 'cash'), isNull(accounts.archivedAt)),
  });
  const cardAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.kind, 'checking'), isNull(accounts.archivedAt)),
  });

  const buttons: { text: string; callback_data: string }[] = [];
  if (cashAccount) {
    buttons.push({ text: `💶 Bar (${cashAccount.name})`, callback_data: `tx_account:${cashAccount.id}` });
  }
  if (cardAccount) {
    buttons.push({ text: `💳 Karte (${cardAccount.name})`, callback_data: `tx_account:${cardAccount.id}` });
  }

  return buttons;
}

async function handleTxAmount(ctx: BotContext, text: string) {
  const amountCents = parseCurrencyFuel(text);
  if (amountCents === null || amountCents <= 0) {
    await ctx.reply('❌ Bitte einen gültigen Betrag eingeben, z.B. 14,80');
    return;
  }

  ctx.session.tx = { ...ctx.session.tx, amountCents };
  ctx.session.step = 'tx_date_choice';

  const today = new Date().toISOString().split('T')[0];
  await ctx.reply(
    `✓ Betrag: ${formatCurrency(amountCents)}\n\n📅 Datum?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `📅 Heute (${today})`, callback_data: 'date_choice:today:tx' },
            { text: '📆 Anderes Datum', callback_data: 'date_choice:custom:tx' },
          ],
        ],
      },
    }
  );
}

async function handleTxDescription(ctx: BotContext, text: string) {
  const tx = ctx.session.tx;
  if (!tx?.amountCents || tx.accountId == null) {
    await ctx.reply('❌ Eingabe unvollständig. Starte mit /transaktion neu.');
    ctx.session = {};
    return;
  }

  // Parse description like a free-text transaction
  const parsed = await parseTransaction(`${(tx.amountCents / 100).toFixed(2).replace('.', ',')} ${text}`);

  let categoryId: number | null = null;
  if (parsed?.category) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.name, parsed.category),
    });
    categoryId = cat?.id || null;
  }

  const [created] = await db
    .insert(transactions)
    .values({
      occurredOn: tx.date ? new Date(tx.date) : (parsed?.date || new Date()),
      amountCents: tx.amountCents,
      direction: 'expense',
      categoryId,
      accountId: tx.accountId,
      merchant: parsed?.merchant,
      note: parsed?.note || null,
      source: 'telegram',
      rawInput: text,
      confidence: parsed?.confidence || 0.8,
      confirmed: true,
    })
    .returning();

  ctx.session.lastTransactionId = created.id;
  ctx.session = {};

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, tx.accountId),
  });

  await ctx.reply(
    '━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ Transaktion gespeichert\n\n` +
      `💳 ${account?.name || 'Konto'}\n` +
      `💰 ${formatCurrency(tx.amountCents)}\n` +
      `📝 ${text}\n` +
      (parsed?.category ? `🏷 ${parsed.category}\n` : '') +
      '━━━━━━━━━━━━━━━━━━━━'
  );
}

export async function handleEinkommen(ctx: BotContext) {
  ctx.session.step = 'income_amount';
  ctx.session.income = {};

  await ctx.reply(
    '💰 Einkommen erfassen\n\n' +
      'Betrag? (z.B. 2500)'
  );
}

async function handleIncomeDateInput(ctx: BotContext, text: string) {
  const today = new Date().toISOString().split('T')[0];
  const date = text === '.' ? today : text;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    await ctx.reply('❌ Ungültiges Datum. Bitte im Format YYYY-MM-DD eingeben, z.B. 2026-08-23');
    return;
  }

  ctx.session.income = { ...ctx.session.income, date };
  ctx.session.step = 'income_type';

  const types = [
    { label: '💼 Gehalt', value: 'Gehalt' },
    { label: '👶 Kindergeld', value: 'Kindergeld' },
    { label: '⏰ Überstunden', value: 'Überstunden' },
    { label: '📦 Sonstiges', value: 'Sonstiges' },
  ];

  await ctx.reply(
    `✓ Datum: ${date}\n\nTyp?`,
    {
      reply_markup: {
        inline_keyboard: [types.map((t) => ({ text: t.label, callback_data: `income_type:${t.value}` }))],
      },
    }
  );
}

async function handleIncomeAmount(ctx: BotContext, text: string) {
  const amountCents = parseCurrencyFuel(text);
  if (amountCents === null || amountCents <= 0) {
    await ctx.reply('❌ Bitte einen gültigen Betrag eingeben, z.B. 2500');
    return;
  }

  ctx.session.income = { ...ctx.session.income, amountCents };
  ctx.session.step = 'income_date_choice';

  const today = new Date().toISOString().split('T')[0];
  await ctx.reply(
    `✓ Betrag: ${formatCurrency(amountCents)}\n\n📅 Datum?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `📅 Heute (${today})`, callback_data: 'date_choice:today:income' },
            { text: '📆 Anderes Datum', callback_data: 'date_choice:custom:income' },
          ],
        ],
      },
    }
  );
}

async function handleIncomeNote(ctx: BotContext, text: string) {
  const income = ctx.session.income;
  if (!income?.amountCents || !income.type) {
    await ctx.reply('❌ Eingabe unvollständig. Starte mit /einkommen neu.');
    ctx.session = {};
    return;
  }

  const notes = text === '-' ? null : text;

  const defaultAccount = await db.query.accounts.findFirst({
    where: and(isNull(accounts.archivedAt), eq(accounts.isDefaultPayment, true)),
  });

  const [created] = await db
    .insert(transactions)
    .values({
      occurredOn: income.date ? new Date(income.date) : new Date(),
      amountCents: income.amountCents,
      direction: 'income',
      categoryId: null,
      accountId: defaultAccount?.id || null,
      merchant: income.type,
      note: notes,
      source: 'telegram',
      rawInput: `${income.type}: ${formatCurrency(income.amountCents)}`,
      confidence: 0.95,
      confirmed: true,
    })
    .returning();

  ctx.session.lastTransactionId = created.id;
  ctx.session = {};

  await ctx.reply(
    '━━━━━━━━━━━━━━━━━━━━\n' +
      `✅ Einkommen gespeichert\n\n` +
      `💰 ${formatCurrency(income.amountCents)}\n` +
      `📦 ${income.type}\n` +
      (notes ? `📝 ${notes}\n` : '') +
      '━━━━━━━━━━━━━━━━━━━━'
  );
}

function parseGermanDecimal(value: string): number | null {
  let cleaned = value.trim().replace(/\s/g, '');
  if (!cleaned) return null;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return num;
}

function parseCurrencyFuel(value: string): number | null {
  let cleaned = value.trim().toLowerCase().replace(/\s/g, '').replace('€', '');
  if (!cleaned) return null;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
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
