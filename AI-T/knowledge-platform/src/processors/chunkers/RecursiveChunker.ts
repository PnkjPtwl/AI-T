import { BaseDocument, Chunk } from '../../interfaces/Document';
import { v4 as uuidv4 } from 'uuid';

export class RecursiveChunker {
  private chunkSize: number;
  private overlap: number;

  constructor(chunkSize = 1000, overlap = 100) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  chunkDocument(doc: BaseDocument): Chunk[] {
    const chunks: Chunk[] = [];
    const text = doc.content;
    let i = 0;
    let index = 0;

    while (i < text.length) {
      let end = i + this.chunkSize;
      let chunkText = text.slice(i, end);

      const header = `Title: ${doc.title}\nSource: ${doc.sourceType}\n\n`;
      const finalContent = header + chunkText;

      chunks.push({
        id: uuidv4(),
        documentId: doc.id,
        chunkIndex: index,
        content: finalContent,
      });

      i += this.chunkSize - this.overlap;
      index++;
    }

    return chunks;
  }
}
