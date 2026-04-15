import type { HtmlResponse, ListingPage } from '@kvkk/shared';
import type { ParsedPost } from '@kvkk/shared';

// CONTRACT:
// Cheerio-based HTML parser for KVKK website pages.
// All parsing is pure functions — no side effects.

export function parseListingPage(html: HtmlResponse): ListingPage {
  // CONTRACT:
  // Input: HtmlResponse (packages/shared/src/types/scrape.ts) — the listing page HTML
  // Output: ListingPage (packages/shared/src/types/scrape.ts) — pageUrl, pageNumber, postUrls[], hasNext
  // Logic:
  //   1. Load HTML with cheerio
  //   2. Select all post link elements matching KVKK listing CSS selector
  //   3. Extract absolute postUrls (resolve relative hrefs against base URL)
  //   4. Detect hasNext by presence of "next page" pagination element
  //   5. Extract pageNumber from pagination or URL query param
  //   6. Return ListingPage
  throw new Error('not implemented');
}

export function parsePostPage(html: HtmlResponse): ParsedPost {
  // CONTRACT:
  // Input: HtmlResponse (packages/shared/src/types/scrape.ts) — the post detail page HTML
  // Output: ParsedPost (packages/shared/src/types/post.ts) — sourceUrl, title, content, publicationDate, incidentDate
  // Logic:
  //   1. Load HTML with cheerio
  //   2. Extract title from <h1> or article heading selector
  //   3. Extract content text from article/content area (strip HTML tags)
  //   4. Extract publicationDate from meta or article date element; parse to Date
  //   5. Call extractDates(content, listingDate) to get incidentDate
  //   6. Return ParsedPost
  throw new Error('not implemented');
}

export function extractDates(
  body: string,
  listingDate: string | null,
): { publicationDate: Date | null; incidentDate: Date | null } {
  // CONTRACT:
  // Input: body (string) — post content text; listingDate (string|null) — date string from listing
  // Output: { publicationDate: Date|null, incidentDate: Date|null }
  // Logic:
  //   1. If listingDate provided, parse to Date for publicationDate; else null
  //   2. Search body for Turkish date patterns (e.g. "01.01.2024", "1 Ocak 2024") using regex
  //   3. Return first match as incidentDate; null if no match
  throw new Error('not implemented');
}
