import { parse } from 'dotenv';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  const parsed = parse(readFileSync(path));
  for (const [key, value] of Object.entries(parsed)) {
    const current = process.env[key];
    if (value && (!current || current.trim() === '')) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(__dirname, '../.env'));
loadEnvFile(resolve(__dirname, '../../web/.env.local'));
loadEnvFile(resolve(__dirname, '../../web/.env'));

export function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

export function getSupabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ''
  );
}

export function getSupabaseAnonKey() {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  );
}

export function getSupabaseAuthKey() {
  return getSupabaseServiceRoleKey() || getSupabaseAnonKey();
}

export function getPostgresUrl() {
  return process.env.POSTGRES_URL || '';
}

export function getVisualsTokenSecret() {
  return process.env.VISUALS_TOKEN_SECRET || '';
}

export function validateEnv() {
  const missing: string[] = [];

  if (!getPostgresUrl()) missing.push('POSTGRES_URL');
  if (!getSupabaseUrl()) missing.push('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
  if (!getSupabaseAuthKey()) {
    missing.push(
      'SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (from Supabase Dashboard → Settings → API)'
    );
  }

  if (missing.length > 0) {
    console.error('\nMissing required environment variables for glow-realtime:\n');
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    console.error('\nCopy values into realtime/.env or ensure web/.env.local is configured.');
    console.error('See realtime/.env.example\n');
    process.exit(1);
  }

  if (!getVisualsTokenSecret()) {
    console.warn(
      '[warn] VISUALS_TOKEN_SECRET is not set. Visuals surface token verification will reject all tokens.'
    );
  }
}
