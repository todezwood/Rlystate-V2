import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NegotiationService } from '../services/negotiation.service';

export const negotiate = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { userMessage } = req.body;
    const buyerId = req.user!.id;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    // If a stale autonomous conversation is active (loop died without closing it),
    // close it so the buyer can proceed with manual negotiation.
    const existingAuto = await prisma.conversation.findFirst({
      where: { listingId, buyerId, autonomyMode: 'autonomous', status: 'active' }
    });
    if (existingAuto) {
      const AGE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
      const ageMs = Date.now() - new Date(existingAuto.createdAt).getTime();
      if (ageMs < AGE_LIMIT_MS) {
        // Loop is likely still running — block to prevent collision
        res.status(409).json({
          error: 'You already have an active AI negotiation on this item.',
          conversationId: existingAuto.id
        });
        return;
      }
      // Loop is stale — close it and allow manual negotiation
      await prisma.conversation.update({
        where: { id: existingAuto.id },
        data: { status: 'walked_away' }
      });
    }

    // Find or create a manual conversation
    let conversation = await prisma.conversation.findFirst({
      where: { listingId, buyerId, autonomyMode: 'manual', status: 'active' }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { listingId, buyerId, sellerId: listing.sellerId, autonomyMode: 'manual' }
      });
    }

    const result = await NegotiationService.runNegotiationRound(buyerId, listingId, userMessage);

    res.json({
      humanMessage: userMessage,
      buyerAgentMessage: result.buyerAgentMessage,
      sellerAgentMessage: result.sellerAgentMessage,
      depositReady: result.depositReady
    });

  } catch (_error: unknown) {
    console.error('Negotiation Error:', _error);
    res.status(500).json({ error: 'Negotiation loop failed' });
  }
};

export const getMyConversations = async (req: Request, res: Response) => {
  try {
    const buyerId = req.user!.id;

    const conversations = await prisma.conversation.findMany({
      where: { buyerId },
      include: {
        listing: {
          select: { id: true, title: true, imageUrl: true, imageUrls: true, askingPrice: true, agreedPrice: true, status: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const result = conversations.map(c => ({
      conversationId: c.id,
      autonomyMode: c.autonomyMode,
      status: c.status,
      listing: c.listing,
      lastMessage: c.messages[0]
        ? { content: c.messages[0].content, sender: c.messages[0].sender, createdAt: c.messages[0].createdAt }
        : null
    }));

    res.json(result);
  } catch (error) {
    console.error('GetMyConversations Error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const buyerId = req.user!.id;

    const conversation = await prisma.conversation.findFirst({
      where: { listingId, buyerId },
      orderBy: { createdAt: 'desc' }
    });
    if (!conversation) {
      res.json([]);
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

export const declineDeal = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const buyerId = req.user!.id;

    // Block decline if Lock in Deal was already clicked (Transaction row exists)
    const existingTransaction = await prisma.transaction.findFirst({
      where: { listingId, buyerId }
    });
    if (existingTransaction) {
      res.status(409).json({ error: 'This deal has already been locked in and cannot be declined.' });
      return;
    }

    const conversation = await prisma.conversation.findFirst({
      where: { listingId, buyerId, status: 'completed' }
    });
    if (!conversation) {
      res.status(404).json({ error: 'No completed deal found for this listing.' });
      return;
    }

    // Atomic: conversation → walked_away first so any running auto-negotiate loop exits on its next round,
    // then listing → ACTIVE. agreedPrice is intentionally preserved as historical record.
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'walked_away' }
      }),
      prisma.listing.updateMany({
        where: { id: listingId, status: 'DEPOSIT_HELD' },
        data: { status: 'ACTIVE' }
      })
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('[decline-deal] Error:', error);
    res.status(500).json({ error: 'Failed to decline deal.' });
  }
};

export const getConversationInfo = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const buyerId = req.user!.id;

    const conversation = await prisma.conversation.findFirst({
      where: { listingId, buyerId },
      orderBy: { createdAt: 'desc' },
      include: {
        listing: {
          select: { id: true, title: true, askingPrice: true, agreedPrice: true, status: true, imageUrl: true, imageUrls: true }
        }
      }
    });

    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const transaction = await prisma.transaction.findFirst({
      where: { listingId, buyerId },
      select: { id: true, amount: true }
    });

    res.json({
      conversationId: conversation.id,
      autonomyMode: conversation.autonomyMode,
      status: conversation.status,
      listing: conversation.listing,
      transactionExists: !!transaction,
      transactionAmount: transaction?.amount ?? null
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch conversation info' });
  }
};
