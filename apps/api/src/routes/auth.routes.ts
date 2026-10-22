import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { OtpService } from '../services/otp.service';

const router = Router();

const sendOtpSchema = z.object({
  phoneNumber: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(8, 'Phone number must contain at least 8 characters')
    .max(20, 'Phone number cannot exceed 20 characters')
    .regex(/^\+?[0-9\s\-()]{8,20}$/, 'Invalid phone number format. Example: +1234567890'),
});

const verifyOtpSchema = z.object({
  phoneNumber: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(8, 'Phone number must contain at least 8 characters'),
  code: z
    .string({ required_error: 'Verification code is required' })
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only numbers'),
});

// POST /api/auth/otp/send
router.post(
  '/otp/send',
  validateBody(sendOtpSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phoneNumber } = req.body;
      const result = await OtpService.sendOtp(phoneNumber);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/otp/verify
router.post(
  '/otp/verify',
  validateBody(verifyOtpSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phoneNumber, code } = req.body;
      const result = await OtpService.verifyOtp(phoneNumber, code);
      res.status(200).json({
        message: 'Authentication successful',
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const authRouter = router;
