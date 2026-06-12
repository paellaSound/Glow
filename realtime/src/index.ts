import { validateEnv } from './env.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers, startCleanupInterval } from './room-manager.js';
import { reconcileOrphanedSessions } from './db.js';
import {
  captureRealtimeException,
  shutdownRealtimePostHog,
} from './analytics/posthog.js';

validateEnv();

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const isDev = process.env.NODE_ENV !== 'production';

function isPrivateNetworkHost(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;

  const allowedOrigins = corsOrigin.split(',').map((value) => value.trim());
  if (allowedOrigins.includes(origin)) return true;

  if (!isDev) return false;

  try {
    const url = new URL(origin);
    return isPrivateNetworkHost(url.hostname) && (url.port === '3000' || url.port === '');
  } catch {
    return false;
  }
}

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'glow-realtime' }));
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ['GET', 'POST'],
  },
});

io.use((_socket, next) => {
  next();
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

startCleanupInterval(io);

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  captureRealtimeException(reason, { error_kind: 'unhandled_rejection' });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  captureRealtimeException(error, { error_kind: 'uncaught_exception' });
});

async function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  await shutdownRealtimePostHog();
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

void reconcileOrphanedSessions().then(() => {
  httpServer.listen(PORT, HOST, () => {
    console.log(`Glow realtime service listening on http://localhost:${PORT}`);
    if (HOST === '0.0.0.0') {
      console.log(`LAN access: use http://<your-ip>:${PORT} from other devices on the same network`);
    }
  });
});
