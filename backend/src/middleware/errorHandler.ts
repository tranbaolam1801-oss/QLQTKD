import { Request, Response, NextFunction } from 'express';

const DATABASE_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2037', 'UNAVAILABLE', 'DEADLINE_EXCEEDED']);

interface ExtendedError extends Error {
  code?: string;
  errorCode?: string;
  meta?: {
    modelName?: string;
    table?: string;
    column?: string;
  };
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const extErr = err as ExtendedError;
  const isPrismaInit = err.name === 'PrismaClientInitializationError';
  const isPrismaKnown = err.name === 'PrismaClientKnownRequestError';
  const prismaCode = extErr.code || extErr.errorCode;
  const meta = extErr.meta;

  console.error('[API_ERROR]', JSON.stringify({
    method: req.method,
    path: req.path,
    name: err.name,
    prismaCode,
    modelName: typeof meta?.modelName === 'string' ? meta.modelName : undefined,
    table: typeof meta?.table === 'string' ? meta.table : undefined,
    column: typeof meta?.column === 'string' ? meta.column : undefined,
  }));

  if (isPrismaInit || DATABASE_UNAVAILABLE_CODES.has(prismaCode || '')) {
    res.status(503).json({
      success: false,
      error: 'Cơ sở dữ liệu tạm thời không khả dụng. Vui lòng thử lại sau.',
      code: 'DATABASE_UNAVAILABLE',
    });
    return;
  }

  if (isPrismaKnown) {
    res.status(500).json({
      success: false,
      error: 'Lỗi cấu hình cơ sở dữ liệu. Vui lòng liên hệ quản trị viên.',
      code: prismaCode === 'P2021' || prismaCode === 'P2022' ? 'DATABASE_SCHEMA_ERROR' : 'DATABASE_QUERY_ERROR',
    });
    return;
  }

  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ success: false, error: 'Token không hợp lệ' });
    return;
  }
  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ success: false, error: 'Token đã hết hạn' });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Lỗi hệ thống, vui lòng thử lại sau',
  });
}
