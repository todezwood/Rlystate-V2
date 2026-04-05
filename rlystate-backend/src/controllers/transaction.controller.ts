import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const simulateDeposit = async (req: Request, res: Response) => {
  try {
    const { listingId, amount } = req.body;
    if (!listingId || amount === undefined || amount === null) {
      res.status(400).json({ error: "listingId and amount are required" });
      return;
    }
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: "amount must be a positive number" });
      return;
    }

    const buyerId = req.user!.id;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    // Idempotency: return existing transaction if one already exists for this buyer + listing
    const existing = await prisma.transaction.findFirst({
      where: { listingId, buyerId },
      orderBy: { createdAt: 'desc' }
    });
    if (existing) {
      res.json({ success: true, transaction: existing });
      return;
    }

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: { listingId, buyerId, amount, status: "COMPLETED" }
      }),
      prisma.listing.update({
        where: { id: listingId },
        data: { status: "DEPOSIT_HELD" }
      })
    ]);

    res.json({ success: true, transaction });
  } catch (error: any) {
    console.error("Simulate Deposit Error:", error);
    res.status(500).json({ error: error.message || "Failed to simulate deposit" });
  }
};

export const getTransactionByListing = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const buyerId = req.user!.id;

    const transaction = await prisma.transaction.findFirst({
      where: { listingId, buyerId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(transaction || null);
  } catch (error: any) {
    console.error("Get Transaction Error:", error);
    res.status(500).json({ error: "Failed to fetch transaction" });
  }
};
