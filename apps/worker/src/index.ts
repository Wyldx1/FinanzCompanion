import 'dotenv/config';
import cron from 'node-cron';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@finanz/db/schema';
import { checkAndSendReminder } from './reminders.js';
import { processRecurringExpenses } from './recurring.js';

// Database connection
const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

const TIMEZONE = process.env.TZ || 'Europe/Berlin';
const REMINDER_HOUR = parseInt(process.env.REMINDER_HOUR || '19', 10);

console.log('Worker starting...');
console.log(`Timezone: ${TIMEZONE}`);
console.log(`Reminder hour: ${REMINDER_HOUR}`);

// Run recurring expenses check once on startup and then daily at 06:00
processRecurringExpenses(db).catch((err) => {
  console.error('[recurring] Startup check failed:', err);
});

cron.schedule(
  '0 6 * * *',
  async () => {
    console.log('[recurring] Running daily check...');
    await processRecurringExpenses(db);
  },
  { timezone: TIMEZONE }
);

// Reminder Stage 1: 28th at 19:00
cron.schedule(
  `0 ${REMINDER_HOUR} 28 * *`,
  async () => {
    console.log('Running reminder stage 1...');
    await checkAndSendReminder(1);
  },
  { timezone: TIMEZONE }
);

// Reminder Stage 2: Last day of month at 19:00
// Since cron doesn't support "last day", run daily and check
cron.schedule(
  `0 ${REMINDER_HOUR} * * *`,
  async () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // If tomorrow is a different month, today is the last day
    if (tomorrow.getMonth() !== today.getMonth()) {
      console.log('Running reminder stage 2 (last day of month)...');
      await checkAndSendReminder(2);
    }
  },
  { timezone: TIMEZONE }
);

// Reminder Stage 3: 3rd of next month at 19:00
cron.schedule(
  `0 ${REMINDER_HOUR} 3 * *`,
  async () => {
    console.log('Running reminder stage 3...');
    await checkAndSendReminder(3);
  },
  { timezone: TIMEZONE }
);

// Health check endpoint
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.statusCode = 200;
    res.end('OK');
  } else {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

const PORT = parseInt(process.env.PORT || '3002', 10);
server.listen(PORT, () => {
  console.log(`Worker health check running on port ${PORT}`);
});

console.log('Worker started. Cron jobs scheduled.');
