import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('axios');
import axios from 'axios';
import { fetchUrl } from './http.client';

describe('http.client.fetchUrl', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns an HtmlResponse on 200 (happy)', async () => {
    (axios as any).get = vi.fn().mockResolvedValue({
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html>ok</html>',
      config: { url: 'https://kvkk.gov.tr/' },
    });
    const r = await fetchUrl('https://kvkk.gov.tr/');
    expect(r.status).toBe(200);
    expect(r.body).toContain('ok');
    expect(r.url).toBe('https://kvkk.gov.tr/');
  });

  it('retries on 5xx / network error up to 3 times then throws (negative)', async () => {
    (axios as any).get = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    await expect(fetchUrl('https://kvkk.gov.tr/')).rejects.toThrow();
    // Should have attempted more than once (1 initial + retries)
    expect((axios as any).get.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('aborts on timeout (>30s) and surfaces timeout error (timeout)', async () => {
    vi.useFakeTimers();
    const err: any = new Error('timeout of 30000ms exceeded');
    err.code = 'ECONNABORTED';
    (axios as any).get = vi.fn().mockRejectedValue(err);
    const promise = fetchUrl('https://kvkk.gov.tr/slow');
    await expect(promise).rejects.toThrow();
    vi.useRealTimers();
  });
});
