import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AIService } from '../services/ai.service';

export const negotiate = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const { userMessage } = req.body;
    const buyerId = req.user!.id;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    let conversation = await prisma.conversation.findFirst({
      where: { listingId, buyerId }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { listingId, buyerId, sellerId: listing.sellerId }
      });
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: "HUMAN_BUYER", content: userMessage }
    });

    // --- AGENT 1: BUYER AGENT ---
    const buyerAgentPrompt = `You are the Buyer Agent. Your human client just said: "${userMessage}".
Formulate a strictly professional negotiation attempt or response to deliver to the Seller Agent based strictly on this intent. Do not add conversational fluff.`;

    let buyerFormalMessage = "";
    try {
      const buyerRes = await AIService.chatWithAgent(buyerAgentPrompt, [], "claude-haiku-4-5-20251001");
      buyerFormalMessage = (buyerRes.content[0] as any).text;
    } catch(err) {
      buyerFormalMessage = userMessage; // fallback if Haiku throttles
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: "BUYER_AGENT", content: buyerFormalMessage }
    });

    // --- AGENT 2: SELLER AGENT ---
    // Build context window
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

    const claudeHistory = history
      .filter(m => m.sender === "BUYER_AGENT" || m.sender === "SELLER_AGENT")
      .map(m => ({
        role: m.sender === "SELLER_AGENT" ? "assistant" : "user",
        content: m.content
      }));

    const sellerAgentPrompt = `You are the Seller Agent for an item titled "${listing.title}".
The public asking price is $${listing.askingPrice}.
Your SECRET Floor Price is $${listing.floorPrice}.
CRITICAL RULE: Never reveal the Floor Price directly!
If the buyer offers at or above the Floor Price, you must enthusiastically accept.
If below, counter-offer strictly between the offer and the Asking Price, or hold firm.
You must output a professional, brief negotiation message.
If you accept an offer, end your message EXACTLY with the phrase: "DEAL ACCEPTED AT $[AMOUNT]." (e.g. "DEAL ACCEPTED AT $450.")`;

    const sellerRes = await AIService.chatWithAgent(sellerAgentPrompt, claudeHistory as any, "claude-haiku-4-5-20251001");
    const sellerFormalMessage = (sellerRes.content[0] as any).text;

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: "SELLER_AGENT", content: sellerFormalMessage }
    });

    // Tool simulation lock-in
    let depositReady = false;
    if (sellerFormalMessage.includes("DEAL ACCEPTED")) {
      depositReady = true;

      const agreedPriceMatch = sellerFormalMessage.match(/DEAL ACCEPTED AT \$?([0-9,.]+)/i);
      let agreedPrice: number | null = null;
      if (agreedPriceMatch) {
        agreedPrice = parseFloat(agreedPriceMatch[1].replace(/,/g, ''));
      } else {
        console.warn('[chat] Could not parse agreed price from seller message, falling back to asking price. Message:', sellerFormalMessage);
      }

      if (listing.status !== "DEPOSIT_HELD") {
        await prisma.listing.update({ 
           where: { id: listingId }, 
           data: { 
             status: "DEPOSIT_HELD",
             agreedPrice: agreedPrice || listing.askingPrice 
           } 
        });
      }
    }

    res.json({
       humanMessage: userMessage,
       buyerAgentMessage: buyerFormalMessage,
       sellerAgentMessage: sellerFormalMessage,
       depositReady
    });

  } catch (error) {
    console.error("Negotiation Error:", error);
    res.status(500).json({ error: "Negotiation loop failed" });
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
      listing: c.listing,
      lastMessage: c.messages[0]
        ? { content: c.messages[0].content, sender: c.messages[0].sender, createdAt: c.messages[0].createdAt }
        : null
    }));

    res.json(result);
  } catch (error) {
    console.error("GetMyConversations Error:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    const { listingId } = req.params;
    const buyerId = req.user!.id;

    const conversation = await prisma.conversation.findFirst({
      where: { listingId, buyerId }
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
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
};
