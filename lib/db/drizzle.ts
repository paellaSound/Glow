import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/postgres';

// For serverless environments (Vercel), we want to reuse the connection across hot reloads
// and limit the pool size to 1 connection per serverless function instance.
const globalForDb = global as unknown as {
  conn: postgres.Sql | undefined;
};

export const client = globalForDb.conn || postgres(connectionString, {
  max: 1, // Only 1 connection per serverless function instance
  idle_timeout: 10, // Close idle connections after 10 seconds
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = client;
}

export const db = drizzle(client, { schema });
