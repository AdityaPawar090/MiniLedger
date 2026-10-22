import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db/prisma';

describe('Loan Summary API (GET /api/loans/summary)', () => {
  let userToken: string;
  let otherUserToken: string;

  beforeEach(async () => {
    await prisma.loan.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.user.deleteMany();

    // Setup main user
    await request(app).post('/api/auth/otp/send').send({ phoneNumber: '+19991112222' });
    const otp1 = await prisma.otpCode.findFirst({ where: { phoneNumber: '+19991112222' } });
    const res1 = await request(app).post('/api/auth/otp/verify').send({ phoneNumber: '+19991112222', code: otp1!.code });
    userToken = res1.body.token;

    // Setup other user
    await request(app).post('/api/auth/otp/send').send({ phoneNumber: '+19993334444' });
    const otp2 = await prisma.otpCode.findFirst({ where: { phoneNumber: '+19993334444' } });
    const res2 = await request(app).post('/api/auth/otp/verify').send({ phoneNumber: '+19993334444', code: otp2!.code });
    otherUserToken = res2.body.token;
  });

  afterAll(async () => {
    await prisma.loan.deleteMany();
    await prisma.otpCode.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should return 0 for all totals when user has no loans', async () => {
    const res = await request(app)
      .get('/api/loans/summary')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalLent: 0,
      totalRepaid: 0,
      overdueAmount: 0,
    });
  });

  it('should accurately calculate totalLent, totalRepaid, and overdueAmount', async () => {
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago (overdue)
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days from now (active)

    // 1. Create an active loan (not overdue): $150.00
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ friendName: 'Active Friend', amount: 150.00, dueDate: futureDate });

    // 2. Create an overdue loan (unpaid and past due): $250.00
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ friendName: 'Overdue Friend', amount: 250.00, dueDate: pastDate });

    // 3. Create a repaid loan: $100.00
    const repaidLoanRes = await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ friendName: 'Repaid Friend', amount: 100.00, dueDate: pastDate });
    await request(app)
      .patch(`/api/loans/${repaidLoanRes.body.id}/repay`)
      .set('Authorization', `Bearer ${userToken}`);

    // 4. Create a loan for other user (should be excluded): $999.00
    await request(app)
      .post('/api/loans')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ friendName: 'Other Friend', amount: 999.00, dueDate: pastDate });

    // Fetch summary for main user
    const res = await request(app)
      .get('/api/loans/summary')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    // Definitions check:
    // Total lent: sum of original amounts of all loans = 150 + 250 + 100 = 500
    expect(res.body.totalLent).toBe(500);

    // Total repaid: sum of amounts for loans marked repaid = 100
    expect(res.body.totalRepaid).toBe(100);

    // Overdue amount: sum of unpaid loans whose due date is before current date = 250
    expect(res.body.overdueAmount).toBe(250);
  });
});
