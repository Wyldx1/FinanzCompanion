import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  accounts,
  snapshots,
  snapshotBalances,
  transactions,
  categories,
  quickActions,
  recurringExpenses,
  goals,
  goalContributions,
  debts,
  vehicles,
  fuelEntries,
  repairs,
  workTimeEntries,
  weightEntries,
  moduleSettings,
  adviceLog,
  commitmentResults,
} from '@finanz/db/schema';
import { sql } from 'drizzle-orm';

const SUPPORTED_VERSIONS = ['1.0', '2.0'];

const PRESERVED_MODULE_IDS = ['telegram', 'reminder_enabled'];

// Tables that are exported/imported in dependency order
const importTables = [
  { name: 'module_settings', table: moduleSettings, key: 'moduleSettings' },
  { name: 'categories', table: categories, key: 'categories' },
  { name: 'accounts', table: accounts, key: 'accounts' },
  { name: 'quick_actions', table: quickActions, key: 'quickActions' },
  { name: 'recurring_expenses', table: recurringExpenses, key: 'recurringExpenses' },
  { name: 'vehicles', table: vehicles, key: 'vehicles' },
  { name: 'snapshots', table: snapshots, key: 'snapshots' },
  { name: 'snapshot_balances', table: snapshotBalances, key: 'snapshotBalances' },
  { name: 'transactions', table: transactions, key: 'transactions' },
  { name: 'goals', table: goals, key: 'goals' },
  { name: 'goal_contributions', table: goalContributions, key: 'goalContributions' },
  { name: 'debts', table: debts, key: 'debts' },
  { name: 'fuel_entries', table: fuelEntries, key: 'fuelEntries' },
  { name: 'repairs', table: repairs, key: 'repairs' },
  { name: 'work_time_entries', table: workTimeEntries, key: 'workTimeEntries' },
  { name: 'weight_entries', table: weightEntries, key: 'weightEntries' },
  { name: 'advice_log', table: adviceLog, key: 'adviceLogs' },
  { name: 'commitment_results', table: commitmentResults, key: 'commitmentResults' },
];

// Tables to truncate before import (reverse dependency order)
const truncateOrder = [
  'commitment_results',
  'advice_log',
  'weight_entries',
  'work_time_entries',
  'fuel_entries',
  'repairs',
  'debts',
  'goal_contributions',
  'goals',
  'transactions',
  'snapshot_balances',
  'snapshots',
  'vehicles',
  'recurring_expenses',
  'quick_actions',
  'accounts',
  'categories',
  'module_settings',
];

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      result[key] = null;
      continue;
    }

    // Convert ISO date strings back to Date objects
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(value)) {
        result[key] = new Date(value);
        continue;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(value) && (key === 'date' || key.endsWith('Date'))) {
        result[key] = new Date(value);
        continue;
      }
    }

    result[key] = value;
  }

  return result;
}

export async function POST(request: NextRequest) {
  await requireAuth();

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: 'MISSING_FILE', message: 'Bitte eine Backup-Datei auswählen' } },
        { status: 400 }
      );
    }

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      return NextResponse.json(
        { error: { code: 'INVALID_FORMAT', message: 'Nur JSON-Dateien werden unterstützt' } },
        { status: 400 }
      );
    }

    const text = await file.text();
    let data: Record<string, unknown>;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_JSON', message: 'Die Datei enthält kein gültiges JSON' } },
        { status: 400 }
      );
    }

    const version = typeof data.version === 'string' ? data.version : 'unknown';
    if (!SUPPORTED_VERSIONS.includes(version)) {
      return NextResponse.json(
        {
          error: {
            code: 'UNSUPPORTED_VERSION',
            message: `Backup-Version ${version} wird nicht unterstützt. Unterstützt: ${SUPPORTED_VERSIONS.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Preserve runtime module settings (e.g. Telegram pairing, reminders)
    const allModuleSettings = await db.query.moduleSettings.findMany();
    const settingsToRestore = allModuleSettings.filter((s) =>
      PRESERVED_MODULE_IDS.includes(s.moduleId)
    );

    await db.transaction(async (tx) => {
      // Truncate all user tables (preserve users/sessions)
      for (const tableName of truncateOrder) {
        await tx.execute(sql.raw(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`));
      }

      // Insert data in dependency order
      for (const { table, key } of importTables) {
        const rows = data[key];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        const normalized = rows.map((row) => normalizeRow(row as Record<string, unknown>));
        await tx.insert(table).values(normalized as never);
      }

      // Restore preserved module settings so Telegram pairing / reminders survive the import
      for (const setting of settingsToRestore) {
        await tx
          .insert(moduleSettings)
          .values({
            moduleId: setting.moduleId,
            enabled: setting.enabled,
            config: setting.config,
          })
          .onConflictDoUpdate({
            target: moduleSettings.moduleId,
            set: {
              enabled: setting.enabled,
              config: setting.config,
              updatedAt: new Date(),
            },
          });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Backup erfolgreich wiederhergestellt',
      restoredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'IMPORT_FAILED',
          message: error instanceof Error ? error.message : 'Wiederherstellung fehlgeschlagen',
        },
      },
      { status: 500 }
    );
  }
}
