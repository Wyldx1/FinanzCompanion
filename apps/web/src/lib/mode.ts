import { db } from './db';
import { moduleSettings } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';

// Module, die standardmäßig aktiv sind, solange sie nicht explizit deaktiviert wurden.
// Damit bleiben Features bei bestehenden Datenbanken sichtbar, bevor ein Seed sie anlegt.
const DEFAULT_ENABLED_MODULES = [
  'core',
  'transactions',
  'debts',
  'goals',
  'coach',
  'telegram',
  'reminder_enabled',
  'fuel',
  'worktime',
  'weight',
];

async function getModuleConfig(moduleId: string): Promise<Record<string, unknown>> {
  const setting = await db.query.moduleSettings.findFirst({
    where: eq(moduleSettings.moduleId, moduleId),
  });
  return (setting?.config as Record<string, unknown>) ?? {};
}

async function setModuleConfig(
  moduleId: string,
  config: Record<string, unknown>
): Promise<void> {
  const existing = await db.query.moduleSettings.findFirst({
    where: eq(moduleSettings.moduleId, moduleId),
  });

  if (existing) {
    await db
      .update(moduleSettings)
      .set({ enabled: true, config, updatedAt: new Date() })
      .where(eq(moduleSettings.moduleId, moduleId));
  } else {
    await db.insert(moduleSettings).values({
      moduleId,
      enabled: true,
      config,
    });
  }
}

export async function isOnboardingComplete(): Promise<boolean> {
  const config = await getModuleConfig('onboarding');
  return config.complete === true;
}

export async function setOnboardingComplete(): Promise<void> {
  await setModuleConfig('onboarding', { complete: true });
}

export async function resetOnboarding(): Promise<void> {
  await setModuleConfig('onboarding', { complete: false });
}

export async function getEnabledModules(): Promise<string[]> {
  const settings = await db.query.moduleSettings.findMany();
  const enabled = new Set<string>();

  for (const moduleId of DEFAULT_ENABLED_MODULES) {
    const setting = settings.find((s) => s.moduleId === moduleId);
    if (!setting || setting.enabled) {
      enabled.add(moduleId);
    }
  }

  // Zusätzlich alle Module, die explizit in der DB aktiviert sind.
  for (const setting of settings) {
    if (setting.enabled) {
      enabled.add(setting.moduleId);
    }
  }

  return Array.from(enabled);
}

export function isModuleEnabledByDefault(moduleId: string): boolean {
  return DEFAULT_ENABLED_MODULES.includes(moduleId);
}
