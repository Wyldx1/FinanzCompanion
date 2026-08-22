import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { accounts, categories, quickActions, moduleSettings, users } from './schema/index.js';
import { hash } from '@node-rs/argon2';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('Seeding database...');

  // Seed Kategorien mit Keywords
  const categoryData = [
    { name: 'Lebensmittel', icon: '🛒', isEssential: true, keywords: ['rewe', 'aldi', 'lidl', 'edeka', 'penny', 'netto', 'kaufland', 'dm', 'rossmann', 'bäcker', 'supermarkt', 'einkauf'], sortOrder: 1 },
    { name: 'Tanken', icon: '⛽', isEssential: true, keywords: ['tanken', 'aral', 'shell', 'esso', 'jet', 'total', 'sprit', 'benzin', 'diesel', 'ladesäule'], sortOrder: 2 },
    { name: 'Mobilität', icon: '🚌', isEssential: true, keywords: ['bahn', 'db', 'deutschlandticket', 'bus', 'taxi', 'uber', 'ticket', 'parken', 'werkstatt', 'tüv'], sortOrder: 3 },
    { name: 'Wohnen', icon: '🏠', isEssential: true, keywords: ['miete', 'nebenkosten', 'strom', 'gas', 'wasser', 'hausgeld', 'internet', 'gez'], sortOrder: 4 },
    { name: 'Versicherungen', icon: '🛡️', isEssential: true, keywords: ['versicherung', 'haftpflicht', 'kfz', 'krankenkasse', 'rechtsschutz'], sortOrder: 5 },
    { name: 'Abos', icon: '🔁', isEssential: true, keywords: ['netflix', 'spotify', 'handy', 'mobilfunk', 'fitness', 'abo', 'cloud', 'prime'], sortOrder: 6 },
    { name: 'Gesundheit', icon: '💊', isEssential: true, keywords: ['apotheke', 'arzt', 'zahnarzt', 'brille', 'rezept', 'physio'], sortOrder: 7 },
    { name: 'Restaurant', icon: '🍕', isEssential: false, keywords: ['restaurant', 'essen gehen', 'lieferando', 'mcdonalds', 'döner', 'pizza', 'imbiss', 'kneipe', 'bar'], sortOrder: 8 },
    { name: 'Kaffee & Snacks', icon: '☕', isEssential: false, keywords: ['kaffee', 'starbucks', 'bäckerei', 'snack', 'kiosk'], sortOrder: 9 },
    { name: 'Kleidung', icon: '👕', isEssential: false, keywords: ['kleidung', 'schuhe', 'zalando', 'h&m', 'jacke'], sortOrder: 10 },
    { name: 'Freizeit', icon: '🎮', isEssential: false, keywords: ['kino', 'konzert', 'spiele', 'steam', 'buch', 'hobby', 'urlaub'], sortOrder: 11 },
    { name: 'Anschaffungen', icon: '📦', isEssential: false, keywords: ['amazon', 'elektronik', 'möbel', 'ikea', 'media markt'], sortOrder: 12 },
    { name: 'Geschenke', icon: '🎁', isEssential: false, keywords: ['geschenk', 'blumen', 'spende'], sortOrder: 13 },
    { name: 'Sonstiges', icon: '❓', isEssential: false, keywords: [], sortOrder: 99 },
  ];

  const insertedCategories = await db.insert(categories).values(categoryData).returning();
  console.log(`Inserted ${insertedCategories.length} categories`);

  // Kategorien-Map für Quick Actions
  const categoryMap = new Map(insertedCategories.map(c => [c.name, c.id]));

  // Seed Konten
  const accountData = [
    { name: 'Girokonto', kind: 'checking' as const, icon: '🏦', sortOrder: 1, isDefaultPayment: false },
    { name: 'Bargeld', kind: 'cash' as const, icon: '💶', sortOrder: 2, isDefaultPayment: true },
  ];

  const insertedAccounts = await db.insert(accounts).values(accountData).returning();
  console.log(`Inserted ${insertedAccounts.length} accounts`);

  const cashAccountId = insertedAccounts.find(a => a.kind === 'cash')?.id;

  // Seed Quick Actions
  const quickActionData = [
    { keyword: 'lebensmittel', label: '🛒 Lebensmittel', categoryId: categoryMap.get('Lebensmittel'), accountId: cashAccountId, sortOrder: 1 },
    { keyword: 'tanken', label: '⛽ Tanken', categoryId: categoryMap.get('Tanken'), accountId: cashAccountId, sortOrder: 2 },
    { keyword: 'restaurant', label: '🍕 Restaurant', categoryId: categoryMap.get('Restaurant'), accountId: cashAccountId, sortOrder: 3 },
    { keyword: 'kaffee', label: '☕ Kaffee', categoryId: categoryMap.get('Kaffee & Snacks'), accountId: cashAccountId, defaultAmountCents: 350, sortOrder: 4 },
    { keyword: 'abo', label: '🔁 Abo', categoryId: categoryMap.get('Abos'), sortOrder: 5 },
    { keyword: 'sonstiges', label: '❓ Sonstiges', categoryId: categoryMap.get('Sonstiges'), sortOrder: 6 },
  ];

  const insertedQuickActions = await db.insert(quickActions).values(quickActionData).returning();
  console.log(`Inserted ${insertedQuickActions.length} quick actions`);

  // Seed Module Settings
  const moduleData = [
    { moduleId: 'core', enabled: true, config: {} },
    { moduleId: 'transactions', enabled: true, config: {} },
    { moduleId: 'debts', enabled: false, config: {} },
    { moduleId: 'goals', enabled: false, config: {} },
    { moduleId: 'coach', enabled: true, config: {} },
  ];

  await db.insert(moduleSettings).values(moduleData);
  console.log('Inserted module settings');

  // Seed default user (password: "changeme" - should be changed after first login)
  const defaultPassword = 'changeme';
  const hashedPassword = await hash(defaultPassword, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  await db.insert(users).values({
    passphraseHash: hashedPassword,
    totpEnabled: false,
  });
  console.log('Created default user (password: changeme)');

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
