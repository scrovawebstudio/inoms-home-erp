import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/sqliteDb';
import { initPostgresDatabase, isPostgresActive, closePostgresPool } from './server/postgresDb';
import { apiRouter } from './server/apiRoutes';

const app = express();
const PORT = 3000;

// Security & Body parsing middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json({ limit: '50mb' }));

// Mount all authoritative Home Server API endpoints under /api
app.use('/api', apiRouter);

// Start Express Server & Integrate Vite
async function startServer() {
  // 1. Initialize SQLite local cache & fallback
  try {
    await initDatabase();
    console.log('✅ INOMS SQLite Primary Storage engine ready');
  } catch (dbErr) {
    console.error('❌ Failed to initialize SQLite database:', dbErr);
  }

  // 2. Initialize PostgreSQL home server database if configured
  try {
    const pgSuccess = await initPostgresDatabase();
    if (pgSuccess) {
      console.log('🐘 INOMS PostgreSQL Multi-Tenant Database engine ACTIVE');
    } else {
      console.log('ℹ️ INOMS Running with SQLite engine (Configure DB_HOST / DATABASE_URL to connect PostgreSQL)');
    }
  } catch (pgErr) {
    console.warn('⚠️ PostgreSQL initialization warning:', pgErr);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 INOMS Full-Stack Backend Server running on http://0.0.0.0:${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      await closePostgresPool();
      console.log('✅ Server stopped cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
