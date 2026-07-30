import axios from 'axios';
import type { BaseDocument } from '../../interfaces/Document';
import { v4 as uuidv4 } from 'uuid';
import { HtmlParser } from '../../processors/parsers/HtmlParser';

export class GmailConnector {
  private accessToken: string;
  private htmlParser: HtmlParser;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.htmlParser = new HtmlParser();
  }

  /**
   * Fetches recent emails from Gmail.
   */
  async fetchRecentEmails(maxResults = 10): Promise<BaseDocument[]> {
    try {
      // 1. Fetch message list
      const listResponse = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params: { maxResults, q: 'is:inbox' },
      });

      const messages = listResponse.data.messages || [];
      const documents: BaseDocument[] = [];

      // 2. Fetch full message details for each
      for (const msg of messages) {
        const detailResponse = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          params: { format: 'full' },
        });

        const data = detailResponse.data;
        const subject = data.payload.headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const sender = data.payload.headers.find((h: any) => h.name === 'From')?.value || 'Unknown Sender';
        const date = data.payload.headers.find((h: any) => h.name === 'Date')?.value;

        // Extract body (Handling multipart/alternative)
        let bodyRaw = '';
        if (data.payload.parts) {
          const part = data.payload.parts.find((p: any) => p.mimeType === 'text/plain' || p.mimeType === 'text/html');
          if (part && part.body && part.body.data) {
            bodyRaw = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        } else if (data.payload.body && data.payload.body.data) {
          bodyRaw = Buffer.from(data.payload.body.data, 'base64').toString('utf-8');
        }

        const cleanContent = this.htmlParser.parse(bodyRaw);

        documents.push({
          id: uuidv4(),
          title: `Email: ${subject}`,
          content: cleanContent,
          sourceType: 'GMAIL',
          metadata: {
            externalId: msg.id,
            sender,
            date,
            threadId: data.threadId,
          },
        });
      }

      return documents;
    } catch (error) {
      console.error('Error fetching Gmail messages:', error);
      throw error;
    }
  }
}
