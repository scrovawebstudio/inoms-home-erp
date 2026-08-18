import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/sqliteDb';
import { initPostgresDatabase, isPostgresActive, closePostgresPool } from './server/postgresDb';
import { apiRouter } from './server/apiRoutes';

const app = express();
const PORT = 3000;

// Health check endpoints (essential for Cloud Run liveness/readiness probes)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', postgres: isPostgresActive(), time: new Date().toISOString() });
});

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
    // Robust resolution of dist directory in CommonJS bundled output
    const distPath = typeof __dirname !== 'undefined'
      ? (path.basename(__dirname) === 'dist' ? __dirname : path.join(__dirname, 'dist'))
      : path.join(process.cwd(), 'dist');

    console.log(`📁 Serving production static files from: ${distPath}`);
    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // Fallback search in cwd/dist
        const fallbackPath = path.join(process.cwd(), 'dist', 'index.html');
        if (fs.existsSync(fallbackPath)) {
          res.sendFile(fallbackPath);
        } else {
          res.status(200).send('<!DOCTYPE html><html><head><title>INOMS</title></head><body><div id="root">Loading INOMS...</div></body></html>');
        }
      }
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

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

