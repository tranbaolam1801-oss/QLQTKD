import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import {
  createSettlement,
  updateSettlement,
  submitSettlement,
  reviewSettlement,
  addFinancialDocument,
  verifyFinancialDocument,
} from '../services/settlement.service';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../types';

const router = Router();

// Get settlement by eventId
router.get('/:eventId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
    const settlement = await prisma.settlement.findFirst({
      where: { eventId },
      include: {
        items: true,
        documents: true,
        submittedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
      },
    });
    res.json({ success: true, data: settlement });
  } catch (err) {
    next(err);
  }
});

// Create settlement
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settlement = await createSettlement(req.body, req.user!.userId);
    res.status(201).json({ success: true, data: settlement });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Update settlement
router.put('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await updateSettlement(id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Submit settlement
router.post('/:id/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const submitted = await submitSettlement(id, req.user!.userId);
    res.json({ success: true, data: submitted, message: 'Đã nộp hồ sơ quyết toán cho Phòng KHTC' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Review settlement (KHTC)
router.post('/:id/review', authenticate, authorize(UserRole.KHTC, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { decision, notes } = req.body;
    const reviewed = await reviewSettlement(id, decision, notes, req.user!.userId);
    res.json({ success: true, data: reviewed, message: 'Đã xử lý quyết toán' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Add document to settlement
router.post('/:id/documents', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doc = await addFinancialDocument(id, req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Verify document (KHTC)
router.put('/documents/:docId/verify', authenticate, authorize(UserRole.KHTC, UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;
    const { isVerified } = req.body;
    const verified = await verifyFinancialDocument(docId, isVerified);
    res.json({ success: true, data: verified });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
