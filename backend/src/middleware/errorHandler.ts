import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('Error:', err.message);
  console.error(err.stack);

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
