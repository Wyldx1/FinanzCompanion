import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const connectionString = process.env.DATABASE_URL!;

// For query purposes
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

// Export schema
export * from './schema/index.js';
export type Database = typeof db;
