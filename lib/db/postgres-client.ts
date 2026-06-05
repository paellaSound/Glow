import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __glowPostgres: Sql | undefined;
}

function resolvePostgresUrl(url: string) {
  if (process.env.POSTGRES_USE_SESSION_POOLER === 'true') {
    return url;
  }

  // App servers should prefer transaction pooling to avoid session caps.
  if (url.includes('pooler.supabase.com:5432')) {
    return url.replace('pooler.supabase.com:5432', 'pooler.supabase.com:6543');
  }

  return url;
}

export function createPostgresClient(url: string): Sql {
  const connectionString = resolvePostgresUrl(url);
  const useTransactionPooler = connectionString.includes(':6543');

  return postgres(connectionString, {
    max: useTransactionPooler ? 1 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: !useTransactionPooler,
  });
}

export function getPostgresClient(url: string): Sql {
  if (!globalThis.__glowPostgres) {
    globalThis.__glowPostgres = createPostgresClient(url);
  }

  return globalThis.__glowPostgres;
}
