import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../../configs/env';

export const qdrant = new QdrantClient({
  url: env.QDRANT_URL,
  ...(env.QDRANT_API_KEY ? { apiKey: env.QDRANT_API_KEY } : {}),
});

export const COLLECTION_NAME = 'knowledge_platform_v1';

export async function ensureCollection() {
  try {
    const result = await qdrant.getCollections();
    const exists = result.collections.find((c) => c.name === COLLECTION_NAME);
    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: 1536, distance: 'Cosine' },
      });
      console.log(`Collection ${COLLECTION_NAME} created.`);
    }
  } catch (error) {
    console.error('Error ensuring Qdrant collection:', error);
  }
}
