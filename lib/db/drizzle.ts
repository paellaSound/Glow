import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  console.warn('⚠️ Warning: POSTGRES_URL environment variable is not set. Using placeholder connection string.');
}

export const client = postgres(process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/postgres');
export const db = drizzle(client, { schema });
