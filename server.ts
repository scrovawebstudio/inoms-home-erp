import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/sqliteDb';
import { apiRouter } from './server/apiRoutes';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Mount all authoritative Home Server API endpoints under /api
app.use('/api', apiRouter);

// Start Express Server & Integrate Vite
async function startServer() {
  // Initialize SQLite primary database & run migrations before taking traffic
  try {
    await initDatabase();
    console.log('✅ INOMS SQLite Primary Database initialized & ready');
  } catch (dbErr) {
    console.error('❌ Failed to initialize SQLite database:', dbErr);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 INOMS Full-Stack Backend Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
