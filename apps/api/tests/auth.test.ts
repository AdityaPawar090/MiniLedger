import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/prisma';

describe('Authentication API (Mock Phone OTP)', () => {
  const testPhone = '+15551234567';

  beforeEach(async () => {
    // Clear test OTP codes and user
    await prisma.loan.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.loan.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('POST /api/auth/otp/send', () => {
    it('should generate an OTP, store it in the database, and return success message without exposing OTP in body', async () => {
      const response = await request(app)
        .post('/api/auth/otp/send')
        .send({ phoneNumber: testPhone });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('OTP generated');
      // Verify that code is NEVER exposed in the JSON response
      expect(response.body.code).toBeUndefined();

      // Verify OTP is recorded in the database
      const dbOtp = await prisma.otpCode.findFirst({
        where: { phoneNumber: testPhone },
      });
      expect(dbOtp).not.toBeNull();
      expect(dbOtp?.code).toHaveLength(6);
      expect(dbOtp?.consumedAt).toBeNull();
      expect(dbOtp?.attempts).toBe(0);
    });

    it('should return 400 for invalid phone numbers', async () => {
      const response = await request(app)
        .post('/api/auth/otp/send')
        .send({ phoneNumber: '123' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    });

    it('should return 400 when phone number is missing', async () => {
      const response = await request(app)
        .post('/api/auth/otp/send')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('POST /api/auth/otp/verify', () => {
    it('should verify correct OTP, mark it consumed, and return signed JWT with user', async () => {
      // 1. Send OTP
      await request(app)
        .post('/api/auth/otp/send')
        .send({ phoneNumber: testPhone });

      // Retrieve the generated OTP directly from DB for test verification
      const dbOtp = await prisma.otpCode.findFirst({
        where: { phoneNumber: testPhone },
        orderBy: { createdAt: 'desc' },
      });
      expect(dbOtp).toBeDefined();

      // 2. Verify OTP
      const verifyRes = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phoneNumber: testPhone, code: dbOtp!.code });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.token).toBeDefined();
      expect(verifyRes.body.user).toBeDefined();
      expect(verifyRes.body.user.phoneNumber).toBe(testPhone);

      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { phoneNumber: testPhone },
      });
      expect(user).not.toBeNull();

      // Verify OTP is marked consumed
      const updatedOtp = await prisma.otpCode.findUnique({
        where: { id: dbOtp!.id },
      });
      expect(updatedOtp?.consumedAt).not.toBeNull();
    });

    it('should reject incorrect OTP and increment attempt counter', async () => {
      await request(app)
        .post('/api/auth/otp/send')
        .send({ phoneNumber: testPhone });

      const wrongRes = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phoneNumber: testPhone, code: '000000' });

      expect(wrongRes.status).toBe(400);
      expect(wrongRes.body.error).toContain('Invalid OTP');

      // Verify attempts counter incremented
      const dbOtp = await prisma.otpCode.findFirst({
        where: { phoneNumber: testPhone },
      });
      expect(dbOtp?.attempts).toBe(1);
    });

    it('should prevent reuse of an already consumed OTP', async () => {
      await request(app)
        .post('/api/auth/otp/send')
        .send({ phoneNumber: testPhone });

      const dbOtp = await prisma.otpCode.findFirst({
        where: { phoneNumber: testPhone },
      });

      // First verification succeeds
      const firstRes = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phoneNumber: testPhone, code: dbOtp!.code });
      expect(firstRes.status).toBe(200);

      // Second verification fails
      const secondRes = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phoneNumber: testPhone, code: dbOtp!.code });
      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error).toContain('No active OTP found');
    });

    it('should reject expired OTPs', async () => {
      // Create an expired OTP directly
      await prisma.otpCode.create({
        data: {
          phoneNumber: testPhone,
          code: '123456',
          expiresAt: new Date(Date.now() - 60000), // 1 minute ago
          attempts: 0,
        },
      });

      const res = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phoneNumber: testPhone, code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('expired');
    });

    it('should reject after maximum attempts exceeded', async () => {
      await prisma.otpCode.create({
        data: {
          phoneNumber: testPhone,
          code: '123456',
          expiresAt: new Date(Date.now() + 300000),
          attempts: 3, // Max reached
        },
      });

      const res = await request(app)
        .post('/api/auth/otp/verify')
        .send({ phoneNumber: testPhone, code: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Maximum verification attempts exceeded');
    });
  });
});
