import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma';
import { env } from '../config/env';

export class OtpService {
  /**
   * Generates a 6-digit OTP, stores it in the database with an expiration date,
   * and prints it prominently in the backend terminal.
   */
  static async sendOtp(phoneNumber: string): Promise<{ success: boolean; message: string }> {
    const normalizedPhone = phoneNumber.trim();

    // Generate a secure 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Save OTP to database
    await prisma.otpCode.create({
      data: {
        phoneNumber: normalizedPhone,
        code,
        expiresAt,
        attempts: 0,
      },
    });

    // Prominently print OTP to terminal for local development
    console.log('\n========================================================');
    console.log(` [MOCK OTP SERVICE] Verification Code`);
    console.log(` Phone Number: ${normalizedPhone}`);
    console.log(` Code:         >>> ${code} <<<`);
    console.log(` Valid for:    ${env.OTP_EXPIRY_MINUTES} minutes`);
    console.log(' Note: Local mock authentication (check server terminal)');
    console.log('========================================================\n');

    return {
      success: true,
      message: 'OTP generated. Please check the backend terminal for your 6-digit code.',
    };
  }

  /**
   * Verifies the provided OTP, enforces expiration and maximum attempts,
   * marks OTP as consumed, creates or retrieves the User record, and returns a signed JWT.
   */
  static async verifyOtp(
    phoneNumber: string,
    code: string
  ): Promise<{ token: string; user: { id: string; phoneNumber: string } }> {
    const normalizedPhone = phoneNumber.trim();
    const inputCode = code.trim();

    // Retrieve the most recent active (unconsumed) OTP for this phone number
    const activeOtp = await prisma.otpCode.findFirst({
      where: {
        phoneNumber: normalizedPhone,
        consumedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!activeOtp) {
      const error: any = new Error('No active OTP found for this phone number. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    // Check expiration
    if (new Date() > activeOtp.expiresAt) {
      const error: any = new Error('The OTP has expired. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    // Check attempt limits
    if (activeOtp.attempts >= env.OTP_MAX_ATTEMPTS) {
      const error: any = new Error('Maximum verification attempts exceeded. Please request a new code.');
      error.statusCode = 400;
      throw error;
    }

    // Validate the OTP code
    if (activeOtp.code !== inputCode) {
      // Increment attempt counter
      const updatedOtp = await prisma.otpCode.update({
        where: { id: activeOtp.id },
        data: { attempts: { increment: 1 } },
      });

      const remaining = env.OTP_MAX_ATTEMPTS - updatedOtp.attempts;
      const error: any = new Error(
        remaining > 0
          ? `Invalid OTP. You have ${remaining} attempt(s) remaining.`
          : 'Invalid OTP. Maximum attempts reached. Please request a new code.'
      );
      error.statusCode = 400;
      throw error;
    }

    // Mark OTP as consumed so it cannot be reused
    await prisma.otpCode.update({
      where: { id: activeOtp.id },
      data: { consumedAt: new Date() },
    });

    // Upsert User record
    const user = await prisma.user.upsert({
      where: { phoneNumber: normalizedPhone },
      update: {},
      create: { phoneNumber: normalizedPhone },
    });

    // Issue signed JWT
    const token = jwt.sign(
      { userId: user.id, phoneNumber: user.phoneNumber },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    return {
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
      },
    };
  }
}
