import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// If Cloud SQL environment variables are present, construct the secure socket URL
if (process.env.SQL_HOST && process.env.SQL_USER) {
  const user = encodeURIComponent(process.env.SQL_USER || '');
  const pass = encodeURIComponent(process.env.SQL_PASSWORD || '');
  const host = encodeURIComponent(process.env.SQL_HOST || '');
  const db = process.env.SQL_DB_NAME || 'cloud_sql_development_database';
  process.env.DATABASE_URL = `postgresql://${user}:${pass}@localhost/${db}?host=${host}&schema=my_due`;
  process.env.DIRECT_URL = process.env.DATABASE_URL;
} else if (
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('POOLER_HOST') ||
  process.env.DATABASE_URL.includes('USER:PASSWORD')
) {
  process.env.DATABASE_URL = 'file:/app/applet/backend/prisma/dev.db';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? parseInt(process.env.PORT || '8080', 10) : 3000;

async function startServer() {
  const { default: app } = await import('./backend/src/app');

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const express = (await import('express')).default;
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  EventFlow Fullstack App running on port ${PORT}!`);
    console.log(`  Dev/App URL: http://localhost:${PORT}`);
    console.log(`  Healthcheck: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
