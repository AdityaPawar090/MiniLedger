import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';

export interface CreateLoanInput {
  friendName: string;
  amount: number;
  dueDate: Date;
  notes?: string;
}

export interface FormattedLoan {
  id: string;
  userId: string;
  friendName: string;
  amount: number;
  dueDate: string;
  notes: string | null;
  isRepaid: boolean;
  repaidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoanSummary {
  totalLent: number;
  totalRepaid: number;
  overdueAmount: number;
}

function formatLoan(loan: any): FormattedLoan {
  return {
    id: loan.id,
    userId: loan.userId,
    friendName: loan.friendName,
    amount: typeof loan.amount?.toNumber === 'function' ? loan.amount.toNumber() : Number(loan.amount),
    dueDate: loan.dueDate.toISOString(),
    notes: loan.notes ?? null,
    isRepaid: loan.isRepaid,
    repaidAt: loan.repaidAt ? loan.repaidAt.toISOString() : null,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}

export class LoanService {
  /**
   * Create a new loan record for the authenticated user.
   */
  static async createLoan(userId: string, input: CreateLoanInput): Promise<FormattedLoan> {
    if (input.amount <= 0) {
      const error: any = new Error('Loan amount must be a positive number greater than 0.');
      error.statusCode = 400;
      throw error;
    }

    const loan = await prisma.loan.create({
      data: {
        userId,
        friendName: input.friendName.trim(),
        amount: new Prisma.Decimal(input.amount),
        dueDate: input.dueDate,
        notes: input.notes?.trim() || null,
        isRepaid: false,
      },
    });

    return formatLoan(loan);
  }

  /**
   * Retrieve all loans belonging strictly to the authenticated user.
   */
  static async getLoans(userId: string): Promise<FormattedLoan[]> {
    const loans = await prisma.loan.findMany({
      where: { userId },
      orderBy: [
        { isRepaid: 'asc' },
        { dueDate: 'asc' },
      ],
    });

    return loans.map(formatLoan);
  }

  /**
   * Mark a loan as repaid.
   * - Only the owner can mark their loan.
   * - Prevents duplicate repayment.
   * - Stores the repayment timestamp.
   */
  static async markLoanAsRepaid(userId: string, loanId: string): Promise<FormattedLoan> {
    // Check if the loan exists and belongs to this user
    const existingLoan = await prisma.loan.findFirst({
      where: {
        id: loanId,
        userId,
      },
    });

    if (!existingLoan) {
      const error: any = new Error('Loan not found or you do not have permission to access it.');
      error.statusCode = 404;
      throw error;
    }

    if (existingLoan.isRepaid) {
      const error: any = new Error('This loan has already been marked as repaid.');
      error.statusCode = 400;
      throw error;
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        isRepaid: true,
        repaidAt: new Date(),
      },
    });

    return formatLoan(updatedLoan);
  }

  /**
   * Compute loan financial summary for the authenticated user:
   * - Total lent: sum of original amounts of all loans.
   * - Total repaid: sum of amounts for loans marked repaid.
   * - Overdue amount: sum of amounts of unpaid loans whose due date is before the current date.
   */
  static async getSummary(userId: string): Promise<LoanSummary> {
    const loans = await prisma.loan.findMany({
      where: { userId },
    });

    const now = new Date();
    let totalLent = 0;
    let totalRepaid = 0;
    let overdueAmount = 0;

    for (const loan of loans) {
      const amount = typeof loan.amount?.toNumber === 'function' ? loan.amount.toNumber() : Number(loan.amount);
      totalLent += amount;

      if (loan.isRepaid) {
        totalRepaid += amount;
      } else if (new Date(loan.dueDate) < now) {
        overdueAmount += amount;
      }
    }

    return {
      totalLent: Math.round(totalLent * 100) / 100,
      totalRepaid: Math.round(totalRepaid * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
    };
  }
}
