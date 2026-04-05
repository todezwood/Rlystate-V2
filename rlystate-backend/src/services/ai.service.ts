import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  // Automatically pulls ANTHROPIC_API_KEY from .env
});

export const AIService = {
  /**
   * Used by the Listing Agent to evaluate an item from a photo.
   * Runs on Claude Sonnet 4.5 for high intelligence.
   */
  async evaluateListing(base64Images: string[], title?: string, description?: string) {
    const prompt = `You are an expert appraiser for second-hand goods. First, use the multiple image angles and user context to identify the exact make/model and act as a strict condition-grader to identify wear-and-tear.
    
Next, tap into your extensive knowledge of secondary markets (such as eBay, Facebook Marketplace, or specialized forums) to recall typical depreciation curves for this specific item in this exact condition. Use this internal market data to estimate a realistic second-hand base price.

Return your response strictly as a JSON object matching this structure:
{
  "suggestedHighPrice": <number>,
  "suggestedLowPrice": <number>,
  "rationale": "<brief explanation>"
}`;

    const contentBlocks: any[] = [];

    for (const base64Image of base64Images) {
      if (!base64Image) continue;
      const match = base64Image.match(/^data:(image\/[a-zA-Z0-9.-]+);base64,(.+)$/);
      let mediaType = "image/jpeg";
      let pureBase64 = base64Image;

      if (match) {
        mediaType = match[1];
        pureBase64 = match[2];
      }

      if (mediaType.includes("heic") || mediaType.includes("heif")) {
         throw new Error("Claude Vision does not support Apple .HEIC photos natively yet. Please screenshot the photo or upload a standard JPEG/PNG!");
      }

      contentBlocks.push({ type: "image", source: { type: "base64", media_type: mediaType, data: pureBase64 } });
    }

    contentBlocks.push({ type: "text", text: `Title: ${title || 'Unknown'}\nDescription: ${description || 'Unknown'}\n\n${prompt}` });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: contentBlocks
        }
      ]
    });
    
    return response;
  },

  /**
   * Used by the Negotiation Agents (Seller Agent & Buyer Agent)
   * Runs on Claude Haiku 4.5 for blazing speed and low cost.
   */
  async chatWithAgent(systemPrompt: string, messageHistory: any[], model: string = "claude-haiku-4-5-20251001") {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: messageHistory,
    });
    return response;
  }
};
