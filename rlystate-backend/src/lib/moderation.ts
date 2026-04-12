import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-vision'],
});

const vision = google.vision({ version: 'v1', auth });

const HARD_BLOCK_LEVELS = ['LIKELY', 'VERY_LIKELY'];

/**
 * Layer 1: Google Cloud Vision SafeSearch.
 * Checks images for adult, violent, or racy content before they reach Claude.
 */
export async function checkImageSafety(base64Images: string[]): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const response = await vision.images.annotate({
      requestBody: {
        requests: base64Images.map(img => ({
          image: { content: img },
          features: [{ type: 'SAFE_SEARCH_DETECTION' }],
        })),
      },
    });

    const results = response.data.responses || [];
    for (const result of results) {
      const annotation = result.safeSearchAnnotation;
      if (!annotation) continue;

      if (HARD_BLOCK_LEVELS.includes(annotation.adult || '')) {
        return { blocked: true, reason: "We couldn't process this photo. Please make sure your listing photos only show the item you're selling." };
      }
      if (HARD_BLOCK_LEVELS.includes(annotation.violence || '')) {
        return { blocked: true, reason: "We couldn't process this photo. It appears to contain content that doesn't meet our listing guidelines." };
      }
    }
    return { blocked: false };
  } catch (error) {
    console.error('[moderation] SafeSearch error:', error);
    // Fail open for POC: if SafeSearch is unavailable, let Claude's Layer 2 handle it
    return { blocked: false };
  }
}

/**
 * Layer 3: Server-side keyword blocklist.
 * Catches unambiguous prohibited terms in AI-generated title and rationale.
 */
const PROHIBITED_TERMS = [
  'firearm', 'handgun', 'pistol', 'rifle', 'shotgun', 'ammunition', 'ammo',
  'suppressor', 'silencer', 'ar-15', 'ar15',
  'cocaine', 'heroin', 'methamphetamine', 'fentanyl', 'oxycontin',
  'escort service', 'sex work', 'sexual service', 'prostitution',
  'dynamite', 'explosive', 'grenade', 'detonator',
  'stolen goods', 'counterfeit', 'fake id', 'forged document',
];

export function checkProhibitedContent(title: string, rationale: string): { blocked: boolean; reason?: string } {
  const text = `${title} ${rationale}`.toLowerCase();
  for (const term of PROHIBITED_TERMS) {
    if (text.includes(term)) {
      return { blocked: true, reason: "This item can't be listed on Rlystate. It falls into a category we don't allow on the platform." };
    }
  }
  return { blocked: false };
}

/**
 * Layer 4: Price ceiling validation.
 * Asking price cannot exceed 125% of the AI's suggested high price.
 */
export function checkPriceCeiling(askingPrice: number, suggestedHighPrice: number): { blocked: boolean; maxPrice: number; reason?: string } {
  const maxPrice = Math.round(suggestedHighPrice * 1.25);
  if (askingPrice > maxPrice) {
    return {
      blocked: true,
      maxPrice,
      reason: `Your asking price exceeds the maximum we allow for this item based on our market estimate. Please set your price at $${maxPrice} or below.`,
    };
  }
  return { blocked: false, maxPrice };
}
