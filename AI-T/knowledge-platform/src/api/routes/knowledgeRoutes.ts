import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RecursiveChunker } from '../../processors/chunkers/RecursiveChunker';
import { embeddingQueue } from '../../workers/queues/embeddingQueue';
import { BaseDocument } from '../../interfaces/Document';

export const knowledgeRouter = Router();
const chunker = new RecursiveChunker(1000, 100);

// Basic ingestion endpoint for raw documents
knowledgeRouter.post('/upload', async (req: Request, res: Response) => {
  try {
    const { title, content, sourceType, metadata } = req.body;

    if (!title || !content || !sourceType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const doc: BaseDocument = {
      id: uuidv4(),
      title,
      content,
      sourceType,
      metadata,
    };

    // 1. Chunk the document
    const chunks = chunker.chunkDocument(doc);

    // 2. Queue chunks for embedding and storage
    for (const chunk of chunks) {
      await embeddingQueue.add(`embed-${chunk.id}`, chunk);
    }

    res.json({
      message: 'Document successfully uploaded and queued for embedding',
      documentId: doc.id,
      chunksCreated: chunks.length,
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});
