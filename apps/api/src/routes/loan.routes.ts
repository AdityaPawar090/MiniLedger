import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validate';
import { LoanService } from '../services/loan.service';

const router = Router();

// Protect all loan routes with JWT authentication
router.use(authMiddleware);

const createLoanSchema = z.object({
  friendName: z
    .string({ required_error: 'Friend name is required' })
    .trim()
    .min(1, 'Friend name cannot be empty')
    .max(100, 'Friend name cannot exceed 100 characters'),
  amount: z
    .coerce
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be a positive number greater than 0'),
  dueDate: z
    .string({ required_error: 'Due date is required' })
    .transform((val, ctx) => {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid ISO date string for due date',
        });
        return z.NEVER;
      }
      return date;
    }),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional(),
});

const loanParamsSchema = z.object({
  id: z.string().min(1, 'Loan ID is required'),
});

// GET /api/loans/summary - Financial metrics
router.get(
  '/summary',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const summary = await LoanService.getSummary(userId);
      res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/loans - Create new loan
router.post(
  '/',
  validateBody(createLoanSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const loan = await LoanService.createLoan(userId, req.body);
      res.status(201).json(loan);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/loans - List authenticated user's loans
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const loans = await LoanService.getLoans(userId);
      res.status(200).json(loans);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/loans/:id/repay - Mark loan as repaid
router.patch(
  '/:id/repay',
  validateParams(loanParamsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const updated = await LoanService.markLoanAsRepaid(userId, id);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

export const loanRouter = router;
