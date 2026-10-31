import dotenv from 'dotenv';
dotenv.config();

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.CORS_ORIGIN)) {
  throw new Error('Production requires JWT_SECRET and CORS_ORIGIN');
}

if (process.env.VERCEL && process.env.STORAGE_DRIVER !== 'supabase') {
  throw new Error('Vercel requires private Supabase Storage');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'eventflow-dev-secret',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: Math.min(parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), process.env.VERCEL ? 4000000 : 10485760),
  aiApiKey: process.env.AI_API_KEY || '',
  aiProvider: process.env.AI_PROVIDER || 'rule-based',
  jwtExpiresIn: '30d',
};
