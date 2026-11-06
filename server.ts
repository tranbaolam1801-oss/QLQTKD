import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

// Production and Development Database: Google Cloud Firebase Firestore
// Database ID: ai-studio-qlqtkd-15ba394f-d8d6-4ef5-bede-4c79a62d3072
// Project ID: gen-lang-client-0601161839
console.log('Target Database: Google Cloud Firebase Firestore (gen-lang-client-0601161839 / ai-studio-qlqtkd-15ba394f-d8d6-4ef5-bede-4c79a62d3072)');
const PORT = parseInt(process.env.PORT || '3000', 10);

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
