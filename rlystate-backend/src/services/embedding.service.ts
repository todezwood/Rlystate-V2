const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-2'; // 1024-dimension general-purpose embeddings

export const EmbeddingService = {
  async embed(text: string): Promise<number[]> {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error('VOYAGE_API_KEY environment variable is not set');

    const res = await fetch(VOYAGE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: VOYAGE_MODEL, input: [text] }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Voyage AI embedding failed (${res.status}): ${err}`);
    }

    const data = await res.json() as { data: { embedding: number[] }[] };
    return data.data[0].embedding;
  },

  listingText(listing: { title: string; description: string; condition?: string; city?: string }, categoryTag?: string): string {
    const parts = [
      categoryTag ? `[${categoryTag}]` : '',
      listing.title,
      listing.description,
      listing.condition ?? '',
      listing.city ?? '',
    ];
    return parts.filter(Boolean).join(' ');
  },
};
