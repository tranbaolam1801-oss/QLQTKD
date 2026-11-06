import express from 'express';
import fs from 'fs';
import path from 'path';
import { databaseJsonReplacer } from './utils/json';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import eventRoutes from './routes/event.routes';
import bookingRoutes from './routes/booking.routes';
import settlementRoutes from './routes/settlement.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import aiRoutes from './routes/ai.routes';
import handoverRoutes from './routes/handover.routes';
import userRoutes from './routes/user.routes';

const app = express();
app.set('json replacer', databaseJsonReplacer);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.corsOrigin.split(',').map(origin => origin.trim()), credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
// Attachments are served exclusively through authenticated event routes.

// Healthcheck with live database readiness check
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'connected';
  let userCount = 0;
  let eventCount = 0;
  try {
    const rawPrisma: any = await import('./config/database');
    const prisma = rawPrisma.default?.default || rawPrisma.default || rawPrisma.prisma;
    userCount = await prisma.user.count();
    eventCount = await prisma.event.count();
  } catch (err: any) {
    dbStatus = `disconnected (${err.message})`;
  }

  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    name: 'EventFlow API Server - ĐH Kinh tế ĐHĐN',
    database: {
      engine: 'Google Cloud Firebase Firestore',
      projectId: 'gen-lang-client-0601161839',
      databaseId: 'ai-studio-qlqtkd-15ba394f-d8d6-4ef5-bede-4c79a62d3072',
      status: dbStatus,
      usersVerified: userCount,
      eventsVerified: eventCount,
    },
    timestamp: new Date().toISOString(),
  });
});


// Secure endpoints to download migration package for safe cross-applet portability
app.get('/api/migration/package.json', (_req, res) => {
  const jsonPath = path.resolve(__dirname, '../prisma/sqlite_exported_data.json');
  if (fs.existsSync(jsonPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="sqlite_exported_data.json"');
    return res.sendFile(jsonPath);
  }
  return res.status(404).json({ error: 'Migration JSON not found' });
});

app.get('/api/migration/schema.sql', (_req, res) => {
  const sqlPath = path.resolve(__dirname, '../../database/01_schema_my_due.sql');
  if (fs.existsSync(sqlPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="01_schema_my_due.sql"');
    return res.sendFile(sqlPath);
  }
  return res.status(404).json({ error: 'Schema SQL not found' });
});

app.get('/api/migration/all-in-one.sql', (_req, res) => {
  const sqlPath = path.resolve(__dirname, '../../database/POSTGRESQL_ALL_IN_ONE_MIGRATION_AND_DATA.sql');
  if (fs.existsSync(sqlPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="POSTGRESQL_ALL_IN_ONE_MIGRATION_AND_DATA.sql"');
    return res.sendFile(sqlPath);
  }
  return res.status(404).json({ error: 'Migration SQL not found' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/facilities', bookingRoutes);
app.use('/api/equipment', bookingRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/handover', handoverRoutes);
app.use('/api/users', userRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;
