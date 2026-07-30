import { Queue, Worker, Job } from 'bullmq';
import { env } from '../../configs/env';
import { OpenAIEmbeddingGenerator } from '../../embeddings/generator/OpenAIEmbedding';
import { qdrant, COLLECTION_NAME } from '../../qdrant/operations/QdrantClient';
import { Chunk } from '../../interfaces/Document';
import { v4 as uuidv4 } from 'uuid';

const QUEUE_NAME = 'embedding-queue';

export const embeddingQueue = new Queue<Chunk>(QUEUE_NAME, {
  connection: { url: env.REDIS_URL },
});

const embeddingGenerator = new OpenAIEmbeddingGenerator();

export const embeddingWorker = new Worker(
  QUEUE_NAME,
  async (job: Job<Chunk>) => {
    const chunk = job.data;
    console.log(`Processing chunk: ${chunk.id}`);

    // Generate Embedding
    const vector = await embeddingGenerator.generate(chunk.content);

    // Upsert to Qdrant
    const pointId = uuidv4();
    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: pointId,
          vector: vector,
          payload: {
            document_id: chunk.documentId,
            chunk_index: chunk.chunkIndex,
            content: chunk.content,
          },
        },
      ],
    });

    console.log(`Successfully stored chunk ${chunk.id} to Qdrant point ${pointId}`);
  },
  {
    connection: { url: env.REDIS_URL },
    concurrency: 5,
  }
);

embeddingWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});
