import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  char,
  real,
  smallint,
  jsonb,
  index,
  unique,
  primaryKey,
  pgEnum,
  date,
  time,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// =====================================================
// ENUMS
// =====================================================

export const accountKindEnum = pgEnum('account_kind', [
  'checking',    // Girokonto
  'cash',        // Bargeld
  'savings',     // Tagesgeld, Festgeld
  'investment',  // Depot, ETF, Krypto
  'receivable',  // Geld, das dir jemand schuldet
  'liability',   // Schulden (Kredit, Dispo, privat)
]);

export const snapshotStatusEnum = pgEnum('snapshot_status', ['draft', 'complete', 'missed']);

export const txDirectionEnum = pgEnum('tx_direction', ['expense', 'income', 'transfer']);

export const txSourceEnum = pgEnum('tx_source', ['telegram', 'web', 'csv_import', 'psd2', 'recurring']);

export const goalKindEnum = pgEnum('goal_kind', [
  'emergency_fund',
  'purchase',
  'debt_payoff',
  'retirement',
  'custom',
]);

export const adviceTriggerEnum = pgEnum('advice_trigger', ['monthly', 'on_demand', 'alert']);

export const vehicleTypeEnum = pgEnum('vehicle_type', ['fuel', 'electric']);

// =====================================================
// KONTEN
// =====================================================

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    kind: accountKindEnum('kind').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    institution: text('institution'),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    includeInNetworth: boolean('include_in_networth').notNull().default(true),
    isDefaultPayment: boolean('is_default_payment').notNull().default(false),
    succeededById: integer('succeeded_by_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    idxAccountsActive: index('idx_accounts_active').on(table.sortOrder),
  })
);

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  successor: one(accounts, {
    fields: [accounts.succeededById],
    references: [accounts.id],
    relationName: 'accountSuccession',
  }),
  snapshotBalances: many(snapshotBalances),
  transactions: many(transactions),
  debt: one(debts),
}));

// =====================================================
// SNAPSHOTS
// =====================================================

export const snapshots = pgTable('snapshots', {
  id: serial('id').primaryKey(),
  period: char('period', { length: 7 }).notNull().unique(), // 'YYYY-MM'
  status: snapshotStatusEnum('status').notNull().default('draft'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }),
  incomeCents: bigint('income_cents', { mode: 'number' }).notNull().default(0),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const snapshotsRelations = relations(snapshots, ({ many }) => ({
  balances: many(snapshotBalances),
}));

export const snapshotBalances = pgTable(
  'snapshot_balances',
  {
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => snapshots.id, { onDelete: 'cascade' }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id),
    balanceCents: bigint('balance_cents', { mode: 'number' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.snapshotId, table.accountId] }),
  })
);

export const snapshotBalancesRelations = relations(snapshotBalances, ({ one }) => ({
  snapshot: one(snapshots, {
    fields: [snapshotBalances.snapshotId],
    references: [snapshots.id],
  }),
  account: one(accounts, {
    fields: [snapshotBalances.accountId],
    references: [accounts.id],
  }),
}));

// =====================================================
// KATEGORIEN
// =====================================================

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  parentId: integer('parent_id'),
  isEssential: boolean('is_essential').notNull().default(false),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  keywords: text('keywords').array().notNull().default([]),
  usageCount: integer('usage_count').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryHierarchy',
  }),
  children: many(categories, { relationName: 'categoryHierarchy' }),
  transactions: many(transactions),
  quickActions: many(quickActions),
}));

// =====================================================
// SCHNELLBEFEHLE
// =====================================================

export const quickActions = pgTable('quick_actions', {
  id: serial('id').primaryKey(),
  keyword: text('keyword').notNull().unique(),
  label: text('label').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  accountId: integer('account_id').references(() => accounts.id),
  direction: txDirectionEnum('direction').notNull().default('expense'),
  defaultAmountCents: bigint('default_amount_cents', { mode: 'number' }),
  merchant: text('merchant'),
  showOnKeyboard: boolean('show_on_keyboard').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  usageCount: integer('usage_count').notNull().default(0),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

export const quickActionsRelations = relations(quickActions, ({ one }) => ({
  category: one(categories, {
    fields: [quickActions.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [quickActions.accountId],
    references: [accounts.id],
  }),
}));

// =====================================================
// WIEDERKEHRENDE AUSGABEN
// =====================================================

export const recurringExpenses = pgTable('recurring_expenses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  direction: txDirectionEnum('direction').notNull().default('expense'),
  categoryId: integer('category_id').references(() => categories.id),
  accountId: integer('account_id').references(() => accounts.id),
  startPeriod: char('start_period', { length: 7 }).notNull(), // 'YYYY-MM'
  endPeriod: char('end_period', { length: 7 }), // optional
  dayOfMonth: smallint('day_of_month').notNull().default(1),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recurringExpensesRelations = relations(recurringExpenses, ({ one }) => ({
  category: one(categories, {
    fields: [recurringExpenses.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [recurringExpenses.accountId],
    references: [accounts.id],
  }),
}));

// =====================================================
// TRANSAKTIONEN
// =====================================================

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    occurredOn: timestamp('occurred_on', { mode: 'date' }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    direction: txDirectionEnum('direction').notNull(),
    categoryId: integer('category_id').references(() => categories.id),
    accountId: integer('account_id').references(() => accounts.id),
    targetAccountId: integer('target_account_id').references(() => accounts.id),
    recurringExpenseId: integer('recurring_expense_id').references(() => recurringExpenses.id),
    merchant: text('merchant'),
    note: text('note'),
    source: txSourceEnum('source').notNull(),
    rawInput: text('raw_input'),
    confidence: real('confidence'),
    confirmed: boolean('confirmed').notNull().default(false),
    externalId: text('external_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxTxPeriod: index('idx_tx_period').on(table.occurredOn),
    idxTxAccount: index('idx_tx_account').on(table.accountId, table.occurredOn),
    idxTxCategory: index('idx_tx_category').on(table.categoryId, table.occurredOn),
  })
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  targetAccount: one(accounts, {
    fields: [transactions.targetAccountId],
    references: [accounts.id],
  }),
  recurringExpense: one(recurringExpenses, {
    fields: [transactions.recurringExpenseId],
    references: [recurringExpenses.id],
  }),
}));

// =====================================================
// SCHULDEN
// =====================================================

export const debts = pgTable('debts', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id')
    .notNull()
    .unique()
    .references(() => accounts.id),
  creditor: text('creditor').notNull(),
  originalCents: bigint('original_cents', { mode: 'number' }).notNull().default(0),
  interestRateBps: integer('interest_rate_bps').notNull().default(0),
  minimumPaymentCents: bigint('minimum_payment_cents', { mode: 'number' }).notNull().default(0),
  dueDay: smallint('due_day'),
  targetPayoffDate: timestamp('target_payoff_date', { mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const debtsRelations = relations(debts, ({ one }) => ({
  account: one(accounts, {
    fields: [debts.accountId],
    references: [accounts.id],
  }),
}));

// =====================================================
// FAHRZEUGE & TANKEN
// =====================================================

export const vehicles = pgTable(
  'vehicles',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    type: vehicleTypeEnum('type').notNull().default('fuel'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxVehiclesSort: index('idx_vehicles_sort').on(table.sortOrder),
  })
);

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  fuelEntries: many(fuelEntries),
}));

export const fuelEntries = pgTable(
  'fuel_entries',
  {
    id: serial('id').primaryKey(),
    vehicleId: integer('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    date: date('date', { mode: 'date' }).notNull(),
    odometerKm: integer('odometer_km').notNull(),
    quantity: real('quantity').notNull(),
    pricePerUnitCents: real('price_per_unit_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxFuelVehicleDate: index('idx_fuel_vehicle_date').on(table.vehicleId, table.date),
  })
);

export const fuelEntriesRelations = relations(fuelEntries, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [fuelEntries.vehicleId],
    references: [vehicles.id],
  }),
}));

// =====================================================
// ZIELE
// =====================================================

export const goals = pgTable('goals', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  kind: goalKindEnum('kind').notNull(),
  targetCents: bigint('target_cents', { mode: 'number' }).notNull(),
  targetDate: timestamp('target_date', { mode: 'date' }),
  priority: smallint('priority').notNull().default(5),
  linkedAccountId: integer('linked_account_id').references(() => accounts.id),
  monthlyPlanCents: bigint('monthly_plan_cents', { mode: 'number' }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  achievedAt: timestamp('achieved_at', { withTimezone: true }),
});

export const goalsRelations = relations(goals, ({ one, many }) => ({
  linkedAccount: one(accounts, {
    fields: [goals.linkedAccountId],
    references: [accounts.id],
  }),
  contributions: many(goalContributions),
}));

export const goalContributions = pgTable(
  'goal_contributions',
  {
    id: serial('id').primaryKey(),
    goalId: integer('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    period: char('period', { length: 7 }).notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  },
  (table) => ({
    goalContributionsGoalIdPeriodUnique: unique().on(table.goalId, table.period),
  })
);

export const goalContributionsRelations = relations(goalContributions, ({ one }) => ({
  goal: one(goals, {
    fields: [goalContributions.goalId],
    references: [goals.id],
  }),
}));

// =====================================================
// COACH
// =====================================================

export const adviceLog = pgTable('advice_log', {
  id: serial('id').primaryKey(),
  period: char('period', { length: 7 }).notNull(),
  trigger: adviceTriggerEnum('trigger').notNull(),
  model: text('model').notNull(),
  metricsJson: jsonb('metrics_json').notNull(),
  verdict: text('verdict').notNull(),
  body: text('body').notNull(),
  commitments: jsonb('commitments').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adviceLogRelations = relations(adviceLog, ({ many }) => ({
  results: many(commitmentResults),
}));

export const commitmentResults = pgTable(
  'commitment_results',
  {
    id: serial('id').primaryKey(),
    adviceId: integer('advice_id')
      .notNull()
      .references(() => adviceLog.id, { onDelete: 'cascade' }),
    commitmentId: text('commitment_id').notNull(),
    evaluatedPeriod: char('evaluated_period', { length: 7 }).notNull(),
    targetCents: bigint('target_cents', { mode: 'number' }),
    actualCents: bigint('actual_cents', { mode: 'number' }),
    met: boolean('met'),
  },
  (table) => ({
    commitmentResultsAdviceCommitmentPeriodUnique: unique().on(
      table.adviceId,
      table.commitmentId,
      table.evaluatedPeriod
    ),
  })
);

export const commitmentResultsRelations = relations(commitmentResults, ({ one }) => ({
  advice: one(adviceLog, {
    fields: [commitmentResults.adviceId],
    references: [adviceLog.id],
  }),
}));

// =====================================================
// ARBEITSZEIT (Dachdecker / SOKA-DACH)
// =====================================================

export const workTimeEntries = pgTable(
  'work_time_entries',
  {
    id: serial('id').primaryKey(),
    date: date('date', { mode: 'date' }).notNull(),
    startTime: time('start_time', { withTimezone: false }).notNull().default('07:30:00'),
    endTime: time('end_time', { withTimezone: false }).notNull(),
    breakMinutes: integer('break_minutes').notNull().default(0),
    site: text('site'),
    notes: text('notes'),
    netMinutes: integer('net_minutes').notNull(),
    targetMinutes: integer('target_minutes').notNull(),
    overtimeMinutes: integer('overtime_minutes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idxWorkTimeDate: index('idx_work_time_date').on(table.date),
  })
);

// =====================================================
// INFRASTRUKTUR
// =====================================================

export const reminders = pgTable(
  'reminders',
  {
    id: serial('id').primaryKey(),
    period: char('period', { length: 7 }).notNull(),
    stage: smallint('stage').notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
    channel: text('channel').notNull().default('telegram'),
  },
  (table) => ({
    remindersPeriodStageUnique: unique().on(table.period, table.stage),
  })
);

export const botSessions = pgTable('bot_sessions', {
  chatId: bigint('chat_id', { mode: 'number' }).primaryKey(),
  state: jsonb('state').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  beforeJson: jsonb('before_json'),
  afterJson: jsonb('after_json'),
  actor: text('actor').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moduleSettings = pgTable('module_settings', {
  moduleId: text('module_id').primaryKey(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// =====================================================
// AUTH
// =====================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  passphraseHash: text('passphrase_hash').notNull(),
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
