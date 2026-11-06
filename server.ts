import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';

// Production and Development Database: Google Cloud Firebase Firestore
// Database ID: ai-studio-qlqtkd-15ba394f-d8d6-4ef5-bede-4c79a62d3072
// Project ID: gen-lang-client-0601161839
console.log('Target Database: Google Cloud Firebase Firestore (gen-lang-client-0601161839 / ai-studio-qlqtkd-15ba394f-d8d6-4ef5-bede-4c79a62d3072)');
const PORT = parseInt(process.env.PORT || (isProd ? '8080' : '3000'), 10);
const HOST = '0.0.0.0';

async function startServer() {
  const rawApp: any = await import('./backend/src/app');
  const app: any = rawApp.default?.default || rawApp.default;

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
    app.get('*', (_req: any, res: any) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`  EventFlow Fullstack App running on port ${PORT}!`);
    console.log(`  Dev/App URL: http://${HOST}:${PORT}`);
    console.log(`  Healthcheck: http://${HOST}:${PORT}/api/health`);
    console.log(`=======================================================`);
  });

  // Graceful shutdown and process stability
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, closing HTTP server gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, closing HTTP server gracefully...');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
