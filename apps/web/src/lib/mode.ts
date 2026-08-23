import { db } from './db';
import { moduleSettings } from '@finanz/db/schema';
import { eq } from 'drizzle-orm';

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
  const settings = await db.query.moduleSettings.findMany({
    where: eq(moduleSettings.enabled, true),
  });
  return settings.map((s) => s.moduleId);
}
