import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/prisma';

describe('Loan Management API', () => {
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;

  beforeEach(async () => {
    await prisma.loan.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.user.deleteMany();

    // Setup User A
    await request(app).post('/api/auth/otp/send').send({ phoneNumber: '+10000000001' });
    const otpA = await prisma.otpCode.findFirst({ where: { phoneNumber: '+10000000001' } });
    const resA = await request(app).post('/api/auth/otp/verify').send({ phoneNumber: '+10000000001', code: otpA!.code });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // Setup User B
    await request(app).post('/api/auth/otp/send').send({ phoneNumber: '+10000000002' });
    const otpB = await prisma.otpCode.findFirst({ where: { phoneNumber: '+10000000002' } });
    const resB = await request(app).post('/api/auth/otp/verify').send({ phoneNumber: '+10000000002', code: otpB!.code });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;
  });

  afterAll(async () => {
    await prisma.loan.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  describe('Authentication protection', () => {
    it('should reject requests without a JWT token', async () => {
      const res = await request(app).get('/api/loans');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Missing Bearer token');
    });

    it('should reject requests with an invalid JWT token', async () => {
      const res = await request(app)
        .get('/api/loans')
        .set('Authorization', 'Bearer invalid_token_123');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/loans (Create Loan)', () => {
    it('should create a loan with valid positive amount, friend name, due date, and optional notes', async () => {
      const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          friendName: 'Alice',
          amount: 150.50,
          dueDate,
          notes: 'Dinner and concert ticket',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.friendName).toBe('Alice');
      expect(res.body.amount).toBe(150.50);
      expect(res.body.notes).toBe('Dinner and concert ticket');
      expect(res.body.isRepaid).toBe(false);
      expect(res.body.repaidAt).toBeNull();
      expect(res.body.userId).toBe(userAId);

      // Verify in DB
      const dbLoan = await prisma.loan.findUnique({ where: { id: res.body.id } });
      expect(dbLoan).not.toBeNull();
      expect(Number(dbLoan?.amount)).toBe(150.50);
    });

    it('should reject negative or zero amounts', async () => {
      const dueDate = new Date().toISOString();

      const zeroRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ friendName: 'Bob', amount: 0, dueDate });
      expect(zeroRes.status).toBe(400);

      const negRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ friendName: 'Bob', amount: -50, dueDate });
      expect(negRes.status).toBe(400);
    });

    it('should reject empty friend name', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          friendName: '   ',
          amount: 100,
          dueDate: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid due date format', async () => {
      const res = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          friendName: 'Charlie',
          amount: 50,
          dueDate: 'not-a-valid-date',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/loans (List Loans)', () => {
    it('should list only the authenticated user loans', async () => {
      // User A creates 2 loans
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ friendName: 'Alice', amount: 50, dueDate: new Date().toISOString() });
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ friendName: 'Bob', amount: 75, dueDate: new Date().toISOString() });

      // User B creates 1 loan
      await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ friendName: 'Dave', amount: 200, dueDate: new Date().toISOString() });

      // Fetch User A loans
      const resA = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body).toHaveLength(2);
      expect(resA.body.map((l: any) => l.friendName)).toEqual(expect.arrayContaining(['Alice', 'Bob']));

      // Fetch User B loans
      const resB = await request(app)
        .get('/api/loans')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(resB.status).toBe(200);
      expect(resB.body).toHaveLength(1);
      expect(resB.body[0].friendName).toBe('Dave');
    });
  });

  describe('PATCH /api/loans/:id/repay (Mark Repaid)', () => {
    it('should mark a loan as repaid and record the timestamp', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ friendName: 'Emma', amount: 100, dueDate: new Date().toISOString() });
      const loanId = createRes.body.id;

      const repayRes = await request(app)
        .patch(`/api/loans/${loanId}/repay`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(repayRes.status).toBe(200);
      expect(repayRes.body.isRepaid).toBe(true);
      expect(repayRes.body.repaidAt).not.toBeNull();

      // Verify in DB
      const dbLoan = await prisma.loan.findUnique({ where: { id: loanId } });
      expect(dbLoan?.isRepaid).toBe(true);
      expect(dbLoan?.repaidAt).not.toBeNull();
    });

    it('should prevent marking a loan as repaid more than once', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ friendName: 'Frank', amount: 80, dueDate: new Date().toISOString() });
      const loanId = createRes.body.id;

      // First mark succeeds
      await request(app)
        .patch(`/api/loans/${loanId}/repay`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Second mark fails with 400
      const secondRes = await request(app)
        .patch(`/api/loans/${loanId}/repay`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.error).toContain('already been marked as repaid');
    });

    it('should enforce user isolation: User B cannot mark User A loan as repaid', async () => {
      const createRes = await request(app)
        .post('/api/loans')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ friendName: 'Grace', amount: 120, dueDate: new Date().toISOString() });
      const userALoanId = createRes.body.id;

      // User B attempts to repay User A's loan
      const unauthorizedRes = await request(app)
        .patch(`/api/loans/${userALoanId}/repay`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(unauthorizedRes.status).toBe(404);
      expect(unauthorizedRes.body.error).toContain('not found or you do not have permission');

      // Verify loan is still unpaid in DB
      const dbLoan = await prisma.loan.findUnique({ where: { id: userALoanId } });
      expect(dbLoan?.isRepaid).toBe(false);
    });
  });
});
