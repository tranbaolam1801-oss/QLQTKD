import { PrismaClient } from '@prisma/client';
import './index';

// A warm process reuses its pool. Never silently fall back to a local database in production.
if (process.env.NODE_ENV === 'production') {
  if (!/^postgres(?:ql)?:/.test(process.env.DATABASE_URL || '')) {
    throw new Error('Production requires a PostgreSQL DATABASE_URL');
  }
  if (process.env.POSTGRES_CUTOVER_APPROVED !== 'true') {
    throw new Error('PostgreSQL cutover requires verified schema and data reconciliation');
  }
}
const globalDatabase = globalThis as unknown as { myDuePrisma?: PrismaClient };
const PostgreSQLClient = /^postgres(?:ql)?:/.test(process.env.DATABASE_URL || '')
  ? (require('../../generated/postgresql').PrismaClient as typeof PrismaClient)
  : PrismaClient;
const prisma = globalDatabase.myDuePrisma ?? new PostgreSQLClient();
globalDatabase.myDuePrisma = prisma;
export default prisma;
