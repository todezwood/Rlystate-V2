import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { EmbeddingService } from '../services/embedding.service';
import { AIService } from '../services/ai.service';
import { NegotiationService } from '../services/negotiation.service';

const SIMILARITY_THRESHOLD = 0.72; // calibrated from debug-search.ts: trash can 0.761, next item 0.685
const RELATIVE_DROP = 0.15;        // max allowed drop from the top result's score

export const searchListings = async (req: Request, res: Response) => {
  try {
    const { descriptionText, referenceImageUrls, maxPrice } = req.body;

    if (!descriptionText) {
      res.status(400).json({ error: 'Please add a text description of what you are looking for.' });
      return;
    }

    let queryText = descriptionText;

    // Interpret reference photos in parallel and merge visual attribute descriptions
    if (referenceImageUrls && referenceImageUrls.length > 0) {
      const t1 = Date.now();
      const descriptions = await Promise.all(
        referenceImageUrls.map(async (imageUrl: string) => {
          try {
            let pureBase64: string;
            const dataUriMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (dataUriMatch) {
              pureBase64 = dataUriMatch[2];
            } else {
              // Fallback: actual URL
              const imgRes = await fetch(imageUrl);
              if (!imgRes.ok) return null;
              const arrayBuffer = await imgRes.arrayBuffer();
              pureBase64 = Buffer.from(arrayBuffer).toString('base64');
            }
            return await AIService.describeReferencePhoto(pureBase64, descriptionText);
          } catch (err) {
            console.error('[buyer-search] Failed to interpret reference photo:', err);
            return null;
          }
        })
      );
      const validDescriptions = descriptions.filter(Boolean) as string[];
      console.log(`[buyer-search] Vision: ${Date.now() - t1}ms | descriptions: ${validDescriptions.join(' | ')}`);
      if (validDescriptions.length > 0) {
        queryText = `${descriptionText} ${validDescriptions.join(' ')}`;
      }
    }

    const t2 = Date.now();
    const vector = await EmbeddingService.embed(queryText);
    console.log(`[buyer-search] Embed: ${Date.now() - t2}ms`);
    const vectorStr = `[${vector.join(',')}]`;

    const userId = req.user!.id;

    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, title, description, "imageUrl", "imageUrls", "askingPrice", "floorPrice", condition, city, status, "sellerId",
              1 - ("embeddingVector" <=> $1::vector) AS similarity
       FROM "Listing"
       WHERE status = 'ACTIVE'
         AND "embeddingVector" IS NOT NULL
         AND 1 - ("embeddingVector" <=> $1::vector) >= ${SIMILARITY_THRESHOLD}
         AND ($2::numeric IS NULL OR "askingPrice" <= $2::numeric)
       ORDER BY "embeddingVector" <=> $1::vector
       LIMIT 8`,
      vectorStr,
      maxPrice ?? null
    );

    console.log(`[buyer-search] Query: "${descriptionText}" | DB results: ${results.length}`);
    results.forEach(r => console.log(`[buyer-search]   "${r.title}" => ${Number(r.similarity).toFixed(4)}`));

    // Relative gap filter: don't return items that fall far below the top match
    let filtered = results;
    if (results.length > 0) {
      const topScore = Number(results[0].similarity);
      const cutoff = Math.max(SIMILARITY_THRESHOLD, topScore - RELATIVE_DROP);
      filtered = results.filter(r => Number(r.similarity) >= cutoff);
      console.log(`[buyer-search] After gap filter (cutoff=${cutoff.toFixed(4)}): ${filtered.length} kept`);
    }

    const tagged = filtered.map(r => ({ ...r, isOwn: r.sellerId === userId }));
    res.json({ listings: tagged });
  } catch (error) {
    console.error('Buyer Search Error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

export const startAutoNegotiate = async (req: Request, res: Response) => {
  try {
    const { listingId, maxPrice } = req.body;
    const buyerId = req.user!.id;

    if (!listingId || !maxPrice || maxPrice <= 0) {
      res.status(400).json({ error: 'listingId and a positive maxPrice are required' });
      return;
    }

    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== 'ACTIVE') {
      res.status(404).json({ error: 'Listing not found or no longer available' });
      return;
    }

    // Duplicate guard: block if an active conversation already exists for this buyer + listing
    const existing = await prisma.conversation.findFirst({
      where: { listingId, buyerId, status: 'active' }
    });
    if (existing) {
      res.status(409).json({
        error: existing.autonomyMode === 'manual'
          ? 'You already have an active manual negotiation on this item.'
          : 'You already have an active AI negotiation on this item.',
        conversationId: existing.id
      });
      return;
    }

    const conversation = await prisma.conversation.create({
      data: { listingId, buyerId, sellerId: listing.sellerId, autonomyMode: 'autonomous', maxPrice }
    });

    // Fire async loop without blocking the response
    setImmediate(() => {
      NegotiationService.runAutoNegotiate(buyerId, listingId, maxPrice, conversation.id)
        .catch(err => console.error('[auto-negotiate] Loop error:', err));
    });

    res.json({ conversationId: conversation.id });
  } catch (error) {
    console.error('Auto-Negotiate Error:', error);
    res.status(500).json({ error: 'Failed to start auto-negotiation' });
  }
};

export const getClosedDeals = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Deals where user was the buyer
    const boughtTransactions = await prisma.transaction.findMany({
      where: { buyerId: userId },
      include: {
        listing: {
          select: { id: true, title: true, imageUrl: true, imageUrls: true, agreedPrice: true, askingPrice: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Deals where user was the seller (via listing.sellerId)
    const soldListings = await prisma.listing.findMany({
      where: { sellerId: userId, status: { in: ['DEPOSIT_HELD', 'SOLD'] } },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });

    const bought = boughtTransactions.map(t => ({
      role: 'bought' as const,
      listingId: t.listing.id,
      title: t.listing.title,
      imageUrl: t.listing.imageUrl,
      imageUrls: t.listing.imageUrls,
      finalPrice: t.amount,
      date: t.createdAt
    }));

    const sold = soldListings.map(l => ({
      role: 'sold' as const,
      listingId: l.id,
      title: l.title,
      imageUrl: l.imageUrl,
      imageUrls: l.imageUrls,
      finalPrice: l.agreedPrice ?? l.askingPrice,
      date: l.transactions[0]?.createdAt ?? l.createdAt
    }));

    const all = [...bought, ...sold].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json(all);
  } catch (error) {
    console.error('GetClosedDeals Error:', error);
    res.status(500).json({ error: 'Failed to fetch closed deals' });
  }
};
