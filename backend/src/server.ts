import app, { getFrontendDistPath } from './app';
import { config } from './config';

const PORT = parseInt(process.env.PORT || String(config.port || 3000), 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  const dist = getFrontendDistPath();
  console.log(`=======================================================`);
  console.log(`  EventFlow Server (Backend + Frontend SPA) running!`);
  console.log(`  PORT: ${PORT} (HOST: ${HOST})`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Frontend Dist: ${dist ? dist : 'NOT FOUND (API only)'}`);
  console.log(`  Healthcheck: http://${HOST}:${PORT}/api/health`);
  console.log(`=======================================================`);
});

