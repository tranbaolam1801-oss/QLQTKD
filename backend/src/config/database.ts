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

import { PrismaClient } from '@prisma/client';
import './index';

const isPostgres =
  /^postgres(?:ql)?:/.test(process.env.DATABASE_URL || '') &&
  !process.env.DATABASE_URL.includes('POOLER_HOST') &&
  !process.env.DATABASE_URL.includes('USER:PASSWORD');

const globalDatabase = globalThis as unknown as { myDuePrisma?: PrismaClient };

let ClientConstructor = PrismaClient;
if (isPostgres) {
  try {
    ClientConstructor = require('../../generated/postgresql').PrismaClient as typeof PrismaClient;
  } catch {
    ClientConstructor = PrismaClient;
  }
}

const prisma = globalDatabase.myDuePrisma ?? new ClientConstructor();
globalDatabase.myDuePrisma = prisma;

export default prisma;
