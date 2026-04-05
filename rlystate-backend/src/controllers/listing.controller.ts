import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AIService } from '../services/ai.service';
import { StorageService } from '../services/storage.service';

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
  } catch (error: any) {
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
  } catch (error: any) {
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

    // Call Claude Vision
    const aiResponse = await AIService.evaluateListing(base64Images, title, description);

    // Extract RAW text from Anthropic response block
    let aiText = '';
    for (const block of aiResponse.content) {
      if (block.type === 'text') { aiText += block.text; }
    }

    // Safely parse JSON even if Claude hallucinates Markdown blocks
    let draft;
    try {
      const cleaned = aiText.replace(/```json\n?/, '').replace(/```/, '');
      draft = JSON.parse(cleaned);
    } catch(e) {
      console.error("Failed to parse strictly as JSON:", aiText);
       res.status(500).json({ error: "AI returned invalid format", raw: aiText });
       return;
    }

    res.json(draft);
  } catch (error: any) {
    console.error("Evaluation Error:", error);
    res.status(500).json({ error: error.message || "Failed to evaluate listing" });
  }
};

export const publishListing = async (req: Request, res: Response) => {
  try {
    const { title, description, imageUrls, askingPrice, floorPrice } = req.body;

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
      where: { status: "ACTIVE", NOT: { sellerId: req.user!.id } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(listings);
  } catch(error) {
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
  } catch (error) {
    res.status(500).json({ error: "DB Fetch Failure" });
  }
};
