import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { getPostgresClient } from './postgres-client';

const client = getPostgresClient(process.env.POSTGRES_URL!);
export const db = drizzle(client, { schema });
