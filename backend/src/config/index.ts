import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET?.trim();

if (isProduction && (!jwtSecret || jwtSecret.length < 16)) {
  throw new Error(
    'LỖI CẤU HÌNH PRODUCTION: Biến môi trường JWT_SECRET bắt buộc phải được thiết lập trong Render Environment Variables với độ dài tối thiểu 16 ký tự để bảo đảm an toàn bảo mật. Vui lòng cấu hình JWT_SECRET trên Render Dashboard.'
  );
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
