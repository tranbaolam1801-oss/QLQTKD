import express from 'express';
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

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'EventFlow API Server - ĐH Kinh tế ĐHĐN',
    database: process.env.DATABASE_URL?.startsWith('postgres') ? 'PostgreSQL (Cloud SQL)' : 'SQLite',
    timestamp: new Date().toISOString(),
  });
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
