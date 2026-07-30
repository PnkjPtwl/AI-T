export interface BaseDocument {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  metadata?: Record<string, any>;
}

export interface Chunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number;
}
