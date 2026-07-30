import axios from 'axios';
import type { BaseDocument } from '../../interfaces/Document';
import { v4 as uuidv4 } from 'uuid';

export class HubspotConnector {
  private accessToken: string;
  private baseUrl = 'https://api.hubapi.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Fetches recently modified notes/engagements from HubSpot and converts them into BaseDocuments.
   */
  async fetchRecentNotes(limit = 50): Promise<BaseDocument[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/crm/v3/objects/notes`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        params: {
          limit,
          properties: 'hs_note_body,hs_created_by',
        },
      });

      const results = response.data.results || [];
      
      return results.map((note: any) => ({
        id: uuidv4(),
        title: `HubSpot Note ${note.id}`,
        content: this.cleanHtml(note.properties.hs_note_body || ''),
        sourceType: 'HUBSPOT',
        metadata: {
          externalId: note.id,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          author: note.properties.hs_created_by,
        },
      }));
    } catch (error) {
      console.error('Error fetching HubSpot notes:', error);
      throw error;
    }
  }

  private cleanHtml(html: string): string {
    // Basic HTML stripping, usually we'd pass this to a proper parser
    return html.replace(/<[^>]*>?/gm, '').trim();
  }
}
