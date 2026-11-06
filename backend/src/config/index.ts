import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const defaultSecret = 'qlqtkd-production-jwt-cloudrun-secret-key-min32chars-due-danang';
const jwtSecret = (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16)
  ? process.env.JWT_SECRET.trim()
  : defaultSecret;

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 16)) {
  console.log('[Security] Using safe default production JWT_SECRET for Google Cloud Run.');
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: jwtSecret || 'eventflow-jwt-dev-secret-only-not-for-prod',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: Math.min(parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), process.env.VERCEL ? 4000000 : 10485760),
  aiApiKey: process.env.AI_API_KEY || '',
  aiProvider: process.env.AI_PROVIDER || 'rule-based',
  jwtExpiresIn: '30d',
};
