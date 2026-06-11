import postgres from 'postgres';

function resolvePostgresUrl(url: string) {
  if (process.env.POSTGRES_USE_SESSION_POOLER === 'true') {
    return url;
  }

  if (url.includes('pooler.supabase.com:5432')) {
    return url.replace('pooler.supabase.com:5432', 'pooler.supabase.com:6543');
  }

  return url;
}

export function createPostgresClient(url: string) {
  const connectionString = resolvePostgresUrl(url);
  const useTransactionPooler = connectionString.includes(':6543');

  return postgres(connectionString, {
    max: useTransactionPooler ? 2 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: !useTransactionPooler,
    connection: {
      statement_timeout: 10_000,
    },
  });
}
