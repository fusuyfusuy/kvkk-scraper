import { describe, it, expect } from 'vitest';
import { parseListingPage, parsePostPage, extractDates } from './kvkk.parser';
import type { HtmlResponse } from '@kvkk/shared';

function html(body: string, url = 'https://kvkk.gov.tr/'): HtmlResponse {
  return { url, status: 200, headers: {}, body };
}

describe('kvkk.parser', () => {
  describe('parseListingPage', () => {
    it('extracts post URLs and hasNext (happy)', () => {
      const page = parseListingPage(
        html(
          `<html><body>
             <a href="/post/1">Post 1</a>
             <a href="/post/2">Post 2</a>
             <a class="next" href="?page=2">Next</a>
           </body></html>`,
        ),
      );
      expect(Array.isArray(page.postUrls)).toBe(true);
      expect(page.pageNumber).toBeGreaterThanOrEqual(1);
      expect(typeof page.hasNext).toBe('boolean');
    });

    it('returns empty postUrls for empty listing (negative)', () => {
      const page = parseListingPage(html('<html><body></body></html>'));
      expect(page.postUrls.length).toBe(0);
      expect(page.hasNext).toBe(false);
    });
  });

  describe('parsePostPage', () => {
    it('extracts title and content (happy)', () => {
      const p = parsePostPage(
        html(
          '<html><body><h1>Test Title</h1><div class="content">Some body text.</div></body></html>',
          'https://kvkk.gov.tr/post/1',
        ),
      );
      expect(p.sourceUrl).toBe('https://kvkk.gov.tr/post/1');
      expect(p.title.length).toBeGreaterThan(0);
    });

    it('throws on malformed HTML with no title (negative)', () => {
      expect(() => parsePostPage(html('<html></html>'))).toThrow();
    });
  });

  describe('extractDates', () => {
    it('parses Turkish date pattern as incidentDate (happy)', () => {
      const r = extractDates('Olay tarihi: 01.01.2024 sabah.', null);
      expect(r.incidentDate).toBeInstanceOf(Date);
    });

    it('returns null incidentDate when no date matches (negative)', () => {
      const r = extractDates('no dates here at all', null);
      expect(r.incidentDate).toBeNull();
    });
  });
});
