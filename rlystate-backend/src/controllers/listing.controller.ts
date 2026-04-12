import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AIService } from '../services/ai.service';
import { StorageService } from '../services/storage.service';
import { EmbeddingService } from '../services/embedding.service';
import { checkImageSafety, checkProhibitedContent, checkPriceCeiling } from '../lib/moderation';

export const uploadDirect = async (req: Request, res: Response) => {
  try {
    const { base64, fileName, contentType } = req.body;
    if (!base64 || !fileName || !contentType) {
      res.status(400).json({ error: "base64, fileName, and contentType are required" });
      return;
    }
    const stripped = base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(stripped, 'base64');
    const { publicUrl } = await StorageService.uploadFile(buffer, fileName, contentType);
    res.json({ publicUrl });
  } catch (error: unknown) {
    console.error("Direct Upload Error:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
};

export const getUploadUrl = async (req: Request, res: Response) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
      res.status(400).json({ error: "fileName and contentType are required" });
      return;
    }
    const result = await StorageService.generateUploadUrl(fileName, contentType);
    res.json(result);
  } catch (error: unknown) {
    console.error("GCS Upload URL Error:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

export const evaluateAndDraft = async (req: Request, res: Response) => {
  try {
    const { imageUrls, title, description } = req.body;
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
       res.status(400).json({ error: "At least one image URL is required in imageUrls array" });
       return;
    }

    const base64Images: string[] = [];
    
    for (const url of imageUrls) {
      console.log("[DIAG] imageUrl received:", url);
      const imgRes = await fetch(url);
      console.log("[DIAG] GCS fetch status:", imgRes.status, "ok:", imgRes.ok, "content-type:", imgRes.headers.get('content-type'));
      if (!imgRes.ok) {
         res.status(400).json({ error: "Failed to securely retrieve image from cloud bucket" });
         return;
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log("[DIAG] arrayBuffer byteLength:", arrayBuffer.byteLength, "buffer length:", buffer.length);

      if (buffer.length === 0) {
        res.status(400).json({ error: "GCS returned empty image body. Check bucket permissions or URL validity." });
        return;
      }

      const base64Image = buffer.toString('base64');
      console.log("[DIAG] base64Image length:", base64Image.length, "prefix:", base64Image.substring(0, 100));
      base64Images.push(base64Image);
    }

    // Layer 1: SafeSearch moderation before AI sees the photos
    const safetyCheck = await checkImageSafety(base64Images);
    if (safetyCheck.blocked) {
      res.status(400).json({ error: safetyCheck.reason });
      return;
    }

    // Call Claude Vision
    const aiResponse = await AIService.evaluateListing(base64Images, title, description);

    // Extract RAW text from Anthropic response block
    let aiText = '';
    for (const block of aiResponse.content) {
      if (block.type === 'text') { aiText += block.text; }
    }

    // Safely parse JSON even if Claude wraps output in Markdown fences or adds explanation text
    let draft;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      const cleaned = jsonMatch ? jsonMatch[0] : aiText;
      draft = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse strictly as JSON:", aiText);
       res.status(500).json({ error: "AI returned invalid format", raw: aiText });
       return;
    }

    // Layer 2: Claude refused to generate a listing (prohibited item detected)
    if (draft.refused) {
      res.status(400).json({ error: draft.message || "This item cannot be listed on Rlystate." });
      return;
    }

    // Layer 3: Keyword blocklist on AI-generated content
    const contentCheck = checkProhibitedContent(draft.suggestedTitle || '', draft.rationale || '');
    if (contentCheck.blocked) {
      res.status(400).json({ error: contentCheck.reason });
      return;
    }

    res.json(draft);
  } catch (error: unknown) {
    console.error("Evaluation Error:", error);
    const message = error instanceof Error ? error.message : "Failed to evaluate listing";
    res.status(500).json({ error: message });
  }
};

export const publishListing = async (req: Request, res: Response) => {
  try {
    const { title, description, imageUrls, askingPrice, floorPrice, suggestedHighPrice } = req.body;

    // Layer 4: Price ceiling enforcement (25% above AI suggested high)
    if (!suggestedHighPrice || suggestedHighPrice <= 0) {
      res.status(400).json({ error: "Missing price estimate. Please re-analyze your item before publishing." });
      return;
    }
    const maxPrice = Math.round(suggestedHighPrice * 1.25);
    if (askingPrice > maxPrice) {
      res.status(400).json({ error: `Your asking price exceeds the maximum we allow for this item. Please set your price at $${maxPrice} or below.` });
      return;
    }

    const listing = await prisma.listing.create({
      data: {
        sellerId: req.user!.id,
        title: title || "AI Appraised Listing",
        description: description || "Details provided via vision agent.",
        imageUrl: imageUrls[0],
        imageUrls: imageUrls,
        askingPrice,
        floorPrice,
        status: "ACTIVE"
      }
    });

    // Embed the listing text for semantic search (non-blocking)
    // Category tag is fetched first to enrich the embedding with product category signal
    AIService.getCategoryTag(listing.title, listing.description)
      .then(categoryTag => EmbeddingService.embed(EmbeddingService.listingText(listing, categoryTag)))
      .then(vector => {
        const vectorStr = `[${vector.join(',')}]`;
        return prisma.$executeRawUnsafe(
          `UPDATE "Listing" SET "embeddingVector" = $1::vector WHERE id = $2`,
          vectorStr,
          listing.id
        );
      })
      .catch(() => console.error('[embed] Failed to embed listing'));

    res.json(listing);
  } catch (error) {
    console.error("Publishing Error:", error);
    res.status(500).json({ error: "Failed to publish listing to Cloud SQL" });
  }
};

// Feed: returns all active listings excluding the current user's own items
export const getListings = async (req: Request, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: 'desc' }
    });
    // Tag each listing so the frontend can disable negotiate buttons on the user's own items
    const userId = req.user!.id;
    const tagged = listings.map(l => ({ ...l, isOwn: l.sellerId === userId }));
    res.json(tagged);
  } catch {
     res.status(500).json({ error: "DB Fetch Failure" });
  }
};

// Seller inventory: returns only the current user's listings
export const getMyListings = async (req: Request, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { sellerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(listings);
  } catch {
    res.status(500).json({ error: "DB Fetch Failure" });
  }
};
