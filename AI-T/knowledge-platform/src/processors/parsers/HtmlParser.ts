export class HtmlParser {
  /**
   * Converts HTML string to clean plain text.
   * In a production system, this could use libraries like 'cheerio' or 'dompurify'.
   */
  parse(htmlContent: string): string {
    if (!htmlContent) return '';
    
    let text = htmlContent;
    
    // Remove scripts and styles
    text = text.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
    text = text.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
    
    // Replace block elements with line breaks
    text = text.replace(/<\/?(div|p|h[1-6]|table|tr|br)[^>]*>/gmi, '\n');
    
    // Remove all remaining tags
    text = text.replace(/<[^>]+>/gmi, '');
    
    // Decode basic HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
    
    // Normalize whitespace (remove multiple empty lines)
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    
    return text;
  }
}
