import axios, { AxiosError } from 'axios';
import type { HtmlResponse } from '@kvkk/shared';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
];

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = process.env['NODE_ENV'] === 'test' ? 0 : 5000;

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0]!;
}

function getBackoffMs(attempt: number): number {
  const baseDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 1000;
  return baseDelay + jitter;
}

function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status && status >= 500) return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('econnrefused') ||
           message.includes('econnreset') ||
           message.includes('etimedout') ||
           message.includes('enotfound') ||
           message.includes('network');
  }
  return true;
}

export async function fetchUrl(url: string): Promise<HtmlResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const userAgent = getRandomUserAgent();
      const response = await axios.get(url, {
        headers: { 'User-Agent': userAgent },
        timeout: 30000,
        maxRedirects: 5,
        responseType: 'text',
        validateStatus: (status) => status < 400,
      });

      const headersRecord: Record<string, string> = {};
      if (response.headers) {
        for (const [key, value] of Object.entries(response.headers)) {
          if (typeof value === 'string') {
            headersRecord[key] = value;
          }
        }
      }

      return {
        url: response.config.url ?? url,
        status: response.status,
        headers: headersRecord,
        body: response.data,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error) || attempt === MAX_RETRIES - 1) {
        throw new Error(`Failed to fetch ${url}: ${lastError.message}`);
      }

      const backoffMs = getBackoffMs(attempt);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message ?? 'Unknown error'}`);
}
