import { prisma } from '../lib/prisma';
import { AIService } from './ai.service';
// TODO: wire EmbeddingService into negotiation context once semantic search per-round is needed

export interface NegotiationResult {
  buyerAgentMessage: string;
  sellerAgentMessage: string;
  depositReady: boolean;
  agreedPrice?: number;
}

export const NegotiationService = {
  async runNegotiationRound(
    buyerId: string,
    listingId: string,
    userMessage: string
  ): Promise<NegotiationResult> {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) throw new Error('Listing not found');

    const conversation = await prisma.conversation.findFirst({
      where: { listingId, buyerId, status: 'active' }
    });
    if (!conversation) throw new Error('No active conversation found');

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: 'HUMAN_BUYER', content: userMessage }
    });

    const buyerAgentPrompt = `You are the Buyer Agent. Your human client just said: "${userMessage}".
Formulate a strictly professional negotiation message to deliver to the Seller Agent based on this intent.
RULES:
- If the human's message contains a dollar amount, you MUST include that exact dollar amount in your response. Do not omit it or replace it with vague language.
- Do not add conversational fluff or meta-commentary.
- One to two sentences maximum.`;

    let buyerFormalMessage = '';
    try {
      const buyerRes = await AIService.chatWithAgent(buyerAgentPrompt, [{ role: 'user', content: userMessage }], 'claude-haiku-4-5-20251001');
      buyerFormalMessage = (buyerRes.content[0] as { text: string }).text;
    } catch {
      buyerFormalMessage = userMessage;
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: 'BUYER_AGENT', content: buyerFormalMessage }
    });

    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

    const claudeHistory: Array<{ role: 'user' | 'assistant'; content: string }> = history
      .filter(m => m.sender === 'BUYER_AGENT' || m.sender === 'SELLER_AGENT')
      .map(m => ({
        role: (m.sender === 'SELLER_AGENT' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content
      }));

    const sellerAgentPrompt = `You are the Seller Agent for an item titled "${listing.title}".
The public asking price is $${listing.askingPrice}.
Your SECRET Floor Price is $${listing.floorPrice}. Never reveal this number.

RULES — follow every one strictly:
1. Extract the buyer's stated dollar amount from their message.
2. Compare it numerically to the Floor Price ($${listing.floorPrice}).
   - If buyer's amount >= $${listing.floorPrice}: you MUST accept. Output one short sentence acknowledging the deal, then on the next line output exactly: DEAL ACCEPTED AT $[BUYER'S EXACT AMOUNT]
   - If buyer's amount < $${listing.floorPrice}: counter with a single specific dollar amount between their offer and $${listing.askingPrice}. Do not accept.
3. Never invent a price the buyer did not state.
4. Two sentences maximum.
5. ACCEPTANCE FORMAT (mandatory when accepting): end your response with a line that is exactly: DEAL ACCEPTED AT $[AMOUNT] where [AMOUNT] is the buyer's exact number. Example: DEAL ACCEPTED AT $24000`;

    const sellerRes = await AIService.chatWithAgent(sellerAgentPrompt, claudeHistory, 'claude-haiku-4-5-20251001');
    const sellerFormalMessage = (sellerRes.content[0] as { text: string }).text;

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: 'SELLER_AGENT', content: sellerFormalMessage }
    });

    let depositReady = false;
    let agreedPrice: number | undefined;

    const dealAccepted =
      sellerFormalMessage.includes('DEAL ACCEPTED') ||
      /\bthe (item|deal|price|offer) is (yours|accepted|agreed)\b/i.test(sellerFormalMessage) ||
      /\bwe have a deal\b/i.test(sellerFormalMessage) ||
      /\bI('ll| will) (accept|take) (that|your offer|the offer)\b/i.test(sellerFormalMessage) ||
      /\bI accept (that|your offer|the offer|this offer)\b/i.test(sellerFormalMessage) ||
      /\b(that('s| is)|it('s| is)) a deal\b/i.test(sellerFormalMessage) ||
      /\bsold( at)?\b.*\$[0-9]/i.test(sellerFormalMessage);

    if (dealAccepted) {
      depositReady = true;
      const match = sellerFormalMessage.match(/DEAL ACCEPTED AT \$?([0-9,.]+)/i)
        ?? sellerFormalMessage.match(/\$([0-9,.]+)/);
      if (match) {
        agreedPrice = parseFloat(match[1].replace(/,/g, ''));
      }
      if (listing.status !== 'DEPOSIT_HELD') {
        await prisma.listing.update({
          where: { id: listingId },
          data: { status: 'DEPOSIT_HELD', agreedPrice: agreedPrice ?? listing.askingPrice }
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'completed' }
        });
      }
    }

    return { buyerAgentMessage: buyerFormalMessage, sellerAgentMessage: sellerFormalMessage, depositReady, agreedPrice };
  },

  async runAutoNegotiate(buyerId: string, listingId: string, maxPrice: number, conversationId: string): Promise<void> {
    const MAX_ROUNDS = 10;

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return;

    // Opening offer: start at 80% of maxPrice to leave room to negotiate upward
    const openingOffer = Math.floor(maxPrice * 0.8);

    const buyerNegotiationPrompt = `You are a buyer agent negotiating the purchase of "${listing.title}" on behalf of a buyer.
RULES:
- Output ONLY the message to send to the seller. No preamble, no explanation, no meta-commentary.
- Never mention, reference, or hint at the buyer's maximum budget under any circumstances.
- Never offer above $${maxPrice}.
- If the seller's price stays above $${maxPrice}, politely walk away.
- Be professional, friendly, and concise. One to two sentences maximum.`;

    // Generate opening offer
    const openingRes = await AIService.chatWithAgent(
      buyerNegotiationPrompt,
      [{ role: 'user', content: `Send your opening offer of $${openingOffer} for the ${listing.title}.` }],
      'claude-haiku-4-5-20251001'
    );
    const openingMessage = (openingRes.content[0] as { text: string }).text;

    // Track whether we have already escalated to maxPrice as a final offer
    let madeMaxOffer = false;
    // Track the last price the buyer offered so extractSellerCounter can exclude it
    let lastBuyerOfferPrice: number = openingOffer;
    // Allows injecting a hardcoded message next round (e.g. the max-price final offer)
    let nextMessage: string | null = null;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      // Pre-round check: is the listing still available?
      const freshListing = await prisma.listing.findUnique({ where: { id: listingId } });
      if (!freshListing || freshListing.status !== 'ACTIVE') {
        await prisma.message.create({
          data: { conversationId, sender: 'BUYER_AGENT', content: 'This item is no longer available.' }
        });
        await prisma.conversation.update({ where: { id: conversationId }, data: { status: 'walked_away' } });
        return;
      }

      let messageToSend: string;
      if (nextMessage !== null) {
        messageToSend = nextMessage;
        nextMessage = null;
      } else if (round === 0) {
        messageToSend = openingMessage;
      } else {
        messageToSend = await generateNextOffer(buyerId, listingId, maxPrice, listing.askingPrice, conversationId);
      }

      // Track the buyer's current offer price for use in counter extraction
      const mentionedByBuyer = extractAllPrices(messageToSend);
      if (mentionedByBuyer.length > 0) {
        lastBuyerOfferPrice = Math.max(...mentionedByBuyer);
      }

      let result: NegotiationResult;
      try {
        result = await NegotiationService.runNegotiationRound(buyerId, listingId, messageToSend);
      } catch {
        // Retry once
        try {
          result = await NegotiationService.runNegotiationRound(buyerId, listingId, messageToSend);
        } catch (retryErr) {
          console.error('[auto-negotiate] Round failed after retry:', retryErr);
          await prisma.conversation.update({ where: { id: conversationId }, data: { status: 'walked_away' } });
          return;
        }
      }

      if (result.depositReady) {
        // Deal closed by seller agent
        await prisma.conversation.update({ where: { id: conversationId }, data: { status: 'completed' } });
        return;
      }

      // Identify the seller's actual counter (minimum price they named, excluding our last offer)
      const sellerCounter = extractSellerCounter(result.sellerAgentMessage, lastBuyerOfferPrice);
      if (sellerCounter && sellerCounter > maxPrice) {
        if (!madeMaxOffer) {
          // First time seller is above budget: escalate to maxPrice as a final offer
          madeMaxOffer = true;
          lastBuyerOfferPrice = maxPrice;
          nextMessage = `I appreciate your patience. My absolute maximum is $${maxPrice} and I truly cannot go any higher. If that works for you, I am ready to move forward right away.`;
        } else {
          // Already offered maxPrice and seller is still above budget: walk away
          const walkAwayMsg = `Thank you for your time. Unfortunately $${maxPrice} is the most I can do and we weren't able to bridge the gap. I'll have to pass.`;
          await prisma.message.create({
            data: { conversationId, sender: 'BUYER_AGENT', content: walkAwayMsg }
          });
          await prisma.conversation.update({ where: { id: conversationId }, data: { status: 'walked_away' } });
          return;
        }
      }
    }

    // Reached max rounds with no deal
    const finalMsg = `I've enjoyed our negotiation, but I wasn't able to reach an agreement within my budget. Thank you for your time.`;
    await prisma.message.create({
      data: { conversationId, sender: 'BUYER_AGENT', content: finalMsg }
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { status: 'walked_away' } });
  }
};

async function generateNextOffer(
  buyerId: string,
  listingId: string,
  maxPrice: number,
  askingPrice: number,
  conversationId: string
): Promise<string> {
  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  });

  const claudeHistory: Array<{ role: 'user' | 'assistant'; content: string }> = history
    .filter(m => m.sender === 'BUYER_AGENT' || m.sender === 'SELLER_AGENT')
    .map(m => ({
      role: (m.sender === 'SELLER_AGENT' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content
    }));

  const prompt = `You are a buyer agent negotiating the purchase of an item originally priced at $${askingPrice}.
RULES:
- Output ONLY the message to send to the seller. No preamble, no explanation, no meta-commentary.
- Never mention, reference, or hint at the buyer's maximum budget under any circumstances.
- Never offer above $${maxPrice}.
- If the seller's latest price is above $${maxPrice}, politely decline and end the conversation.
- Be professional, friendly, and concise. One to two sentences maximum.`;

  claudeHistory.push({ role: 'user', content: 'Send your next negotiation message to the seller.' });

  const res = await AIService.chatWithAgent(prompt, claudeHistory, 'claude-haiku-4-5-20251001');
  const message = (res.content[0] as { text: string }).text;

  // Hard cap: if the generated message contains any price above maxPrice, the agent has
  // gone rogue. Replace with a walk-away message — do not trust the LLM output here.
  const mentionedPrices = extractAllPrices(message);
  if (mentionedPrices.some(p => p > maxPrice)) {
    return `I appreciate the negotiation, but $${maxPrice} is my absolute maximum and I can't go higher. If that works for you, I'd love to move forward. Otherwise, thank you for your time.`;
  }

  return message;
}

// Returns all dollar amounts mentioned in text, sorted ascending
function extractAllPrices(text: string): number[] {
  const matches = [...text.matchAll(/\$([0-9,]+(?:\.[0-9]{1,2})?)/g)];
  return matches.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(n => !isNaN(n));
}

// Returns the seller's counter-offer price from their message.
// Sellers typically state the buyer's rejected offer AND their counter. We exclude the buyer's
// last offer price and return the minimum of whatever remains, since the counter is the lowest
// price the seller is willing to accept, not the highest number they mention.
function extractSellerCounter(text: string, buyerLastOfferPrice: number | null): number | null {
  const prices = extractAllPrices(text);
  if (prices.length === 0) return null;

  // Filter out the buyer's last offer price (with a small tolerance for rounding)
  const TOLERANCE = 0.5;
  const sellerPrices = buyerLastOfferPrice !== null
    ? prices.filter(p => Math.abs(p - buyerLastOfferPrice) > TOLERANCE)
    : prices;

  if (sellerPrices.length === 0) {
    // All mentioned prices were the buyer's own offer — seller may just be acknowledging it.
    // Treat as no counter (don't walk away yet).
    return null;
  }

  // The seller's actual counter is the lowest price they name (their best offer)
  return Math.min(...sellerPrices);
}
