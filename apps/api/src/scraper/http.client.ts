import type { HtmlResponse } from '@kvkk/shared';

// CONTRACT:
// Axios-based HTTP client with:
//   - User-agent rotation (pool of common browser UA strings)
//   - 302/301 redirect following (maxRedirects: 5)
//   - Retry on 5xx or network error (3 attempts, exponential backoff)
//   - 30s timeout per request
// Exports a single fetchUrl function.

export async function fetchUrl(url: string): Promise<HtmlResponse> {
  // CONTRACT:
  // Input: url (string) — absolute URL to fetch
  // Output: HtmlResponse (packages/shared/src/types/scrape.ts) — url, status, headers, body
  // Logic:
  //   1. Pick random user-agent from rotation pool
  //   2. axios.get(url, { headers: { 'User-Agent': ua }, timeout: 30000, maxRedirects: 5, responseType: 'text' })
  //   3. On network error or 5xx, retry up to 3 times with exponential backoff (1s, 2s, 4s)
  //   4. Return { url: response.config.url ?? url, status: response.status, headers: response.headers, body: response.data }
  throw new Error('not implemented');
}
