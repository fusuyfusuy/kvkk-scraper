import { describe, it, expect } from 'vitest';
import {
  parseListingPage,
  parsePostPage,
  extractDates,
  parseTurkishLongDate,
  parseDottedDate,
  extractIncidentDate,
  extractPostId,
} from './kvkk.parser';
import type { HtmlResponse } from '@kvkk/shared';

function html(body: string, url = 'https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=1'): HtmlResponse {
  return { url, status: 200, headers: {}, body };
}

// ---------------------------------------------------------------------------
// Fixtures — trimmed snippets of the current live markup.
// ---------------------------------------------------------------------------

const LISTING_FIXTURE = `
<html><body>
  <div class="row">
    <div class="col-lg-3">
      <div class="news__box">
        <a href="https://www.kvkk.gov.tr/Icerik/8733/kamuoyu-duyurusu-veri-ihlali-bildirimi-english-time-egitim-kurumlari-as" title="English Time">
          <img src="/img1.jpg" class="img-fluid" alt="">
        </a>
        <div class="news__box-meta">
          <a href="https://www.kvkk.gov.tr/Icerik/8733/kamuoyu-duyurusu-veri-ihlali-bildirimi-english-time-egitim-kurumlari-as" title="English Time">
            Kamuoyu Duyurusu (Veri İhlali Bildirimi) – English Time Eğitim Kurumları AŞ
          </a>
          <p class="date">15 Nisan 2026, Çarşamba</p>
        </div>
      </div>
    </div>
    <div class="col-lg-3">
      <div class="news__box">
        <a href="/Icerik/8732/ornek-sirket" title="Ornek">
          <img src="/img2.jpg" class="img-fluid" alt="">
        </a>
        <div class="news__box-meta">
          <a href="/Icerik/8732/ornek-sirket" title="Ornek">
            Kamuoyu Duyurusu (Veri İhlali Bildirimi) – Örnek Şirket
          </a>
          <p class="date">10 Nisan 2026, Cuma</p>
        </div>
      </div>
    </div>
  </div>
  <ul class="pagination justify-content-center">
    <li class="page-item previous"><a href="https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=1">«</a></li>
    <li class="page-item active"><a href="https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=1">1</a></li>
    <li class="page-item"><a href="https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=2">2</a></li>
    <li class="page-item"><a href="https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=3">3</a></li>
    <li class="page-item next"><a href="https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=2">»</a></li>
  </ul>
</body></html>
`;

const LISTING_LAST_PAGE_FIXTURE = `
<html><body>
  <div class="news__box">
    <div class="news__box-meta">
      <a href="/Icerik/1000/son-sayfa-ornek">Son Sayfa Örnek</a>
      <p class="date">1 Ocak 2020, Çarşamba</p>
    </div>
  </div>
  <ul class="pagination">
    <li class="page-item previous"><a href="/veri-ihlali-bildirimi/?page=2">«</a></li>
    <li class="page-item"><a href="/veri-ihlali-bildirimi/?page=1">1</a></li>
    <li class="page-item"><a href="/veri-ihlali-bildirimi/?page=2">2</a></li>
    <li class="page-item active"><a href="/veri-ihlali-bildirimi/?page=3">3</a></li>
    <li class="page-item next"><a href="/veri-ihlali-bildirimi/?page=3">»</a></li>
  </ul>
</body></html>
`;

const DETAIL_FIXTURE = `
<html><body>
<main class="container">
  <div class="breadcrumb-wrapper">
    <nav><ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="/">Ana Sayfa</a></li>
      <li class="breadcrumb-item active">Kamuoyu Duyurusu (Veri İhlali Bildirimi) – English Time Eğitim Kurumları AŞ</li>
    </ol></nav>
  </div>
  <section class="news">
    <div class="row">
      <div class="col-lg-8">
        <div class="news__detail">
          <div class="news__detail-head">
            <img src="/header.jpg" alt="">
            <div class="news__detail-head-meta">
              <div>
                <i class="fa-light fa-calendar"></i>
                <span class="title">Yayınlanma Tarihi:</span>
                <span>15 Nisan 2026, Çarşamba</span>
              </div>
            </div>
          </div>
          <div class="news__detail-article">
            <h2 class="news__detail-article-title">Kamuoyu Duyurusu (Veri İhlali Bildirimi) – English Time Eğitim Kurumları AŞ</h2>
            <p>6698 sayılı Kişisel Verilerin Korunması Kanunu...</p>
            <p>Veri sorumlusu sıfatını haiz English Time tarafından Kurula iletilen veri ihlal bildiriminde özetle;</p>
            <ul>
              <li>İhlalin 04.04.2026 tarihinde başladığı ve 12.04.2026 tarihinde tespit edildiği,</li>
              <li>Saldırganların CRM sistemine sızdığı,</li>
              <li>Veri ihlalinden yaklaşık 300.000 kişinin etkilendiği</li>
            </ul>
            <p>Kamuoyuna saygıyla duyurulur.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>
</body></html>
`;

// ---------------------------------------------------------------------------

describe('kvkk.parser', () => {
  describe('parseListingPage', () => {
    it('extracts absolute post URLs from .news__box entries', () => {
      const page = parseListingPage(html(LISTING_FIXTURE));
      expect(page.postUrls).toEqual([
        'https://www.kvkk.gov.tr/Icerik/8733/kamuoyu-duyurusu-veri-ihlali-bildirimi-english-time-egitim-kurumlari-as',
        'https://www.kvkk.gov.tr/Icerik/8732/ornek-sirket',
      ]);
    });

    it('derives pageNumber and hasNext from .pagination', () => {
      const page = parseListingPage(html(LISTING_FIXTURE));
      expect(page.pageNumber).toBe(1);
      expect(page.hasNext).toBe(true);
    });

    it('reports hasNext=false when the next link points to the current page (last page)', () => {
      const page = parseListingPage(
        html(LISTING_LAST_PAGE_FIXTURE, 'https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=3'),
      );
      expect(page.pageNumber).toBe(3);
      expect(page.hasNext).toBe(false);
      expect(page.postUrls).toEqual(['https://www.kvkk.gov.tr/Icerik/1000/son-sayfa-ornek']);
    });

    it('returns empty postUrls when there are no .news__box entries', () => {
      const page = parseListingPage(html('<html><body></body></html>'));
      expect(page.postUrls).toEqual([]);
      expect(page.hasNext).toBe(false);
    });
  });

  describe('parsePostPage', () => {
    it('parses title, publication date, content, and incident date from the live markup', () => {
      const url =
        'https://www.kvkk.gov.tr/Icerik/8733/kamuoyu-duyurusu-veri-ihlali-bildirimi-english-time-egitim-kurumlari-as';
      const post = parsePostPage(html(DETAIL_FIXTURE, url));

      expect(post.sourceUrl).toBe(url);
      expect(post.title).toBe(
        'Kamuoyu Duyurusu (Veri İhlali Bildirimi) – English Time Eğitim Kurumları AŞ',
      );

      expect(post.publicationDate).toBeInstanceOf(Date);
      expect(post.publicationDate?.toISOString().slice(0, 10)).toBe('2026-04-15');

      expect(post.incidentDate).toBeInstanceOf(Date);
      expect(post.incidentDate?.toISOString().slice(0, 10)).toBe('2026-04-04');

      // Content preserves paragraph + list structure and excludes the h2 title.
      expect(post.content).toContain('6698 sayılı');
      expect(post.content).toContain('- İhlalin 04.04.2026 tarihinde başladığı');
      expect(post.content).toContain('- Veri ihlalinden yaklaşık 300.000 kişinin etkilendiği');
      expect(post.content).not.toMatch(/^Kamuoyu Duyurusu/);
    });

    it('falls back to breadcrumb title when article title is missing', () => {
      const url = 'https://www.kvkk.gov.tr/Icerik/1/x';
      const body = `
        <main>
          <ol class="breadcrumb">
            <li class="breadcrumb-item active">Fallback Title</li>
          </ol>
          <div class="news__detail-article"><p>Body text.</p></div>
        </main>`;
      const post = parsePostPage(html(body, url));
      expect(post.title).toBe('Fallback Title');
    });

    it('throws PARSE_FAILED when no title is discoverable', () => {
      expect(() => parsePostPage(html('<html><body></body></html>'))).toThrow(/PARSE_FAILED/);
    });
  });

  describe('parseTurkishLongDate', () => {
    it('parses "15 Nisan 2026, Çarşamba"', () => {
      const d = parseTurkishLongDate('15 Nisan 2026, Çarşamba');
      expect(d?.toISOString().slice(0, 10)).toBe('2026-04-15');
    });

    it('parses all twelve Turkish month names', () => {
      expect(parseTurkishLongDate('1 Ocak 2026')?.getUTCMonth()).toBe(0);
      expect(parseTurkishLongDate('1 Şubat 2026')?.getUTCMonth()).toBe(1);
      expect(parseTurkishLongDate('1 Mart 2026')?.getUTCMonth()).toBe(2);
      expect(parseTurkishLongDate('1 Nisan 2026')?.getUTCMonth()).toBe(3);
      expect(parseTurkishLongDate('1 Mayıs 2026')?.getUTCMonth()).toBe(4);
      expect(parseTurkishLongDate('1 Haziran 2026')?.getUTCMonth()).toBe(5);
      expect(parseTurkishLongDate('1 Temmuz 2026')?.getUTCMonth()).toBe(6);
      expect(parseTurkishLongDate('1 Ağustos 2026')?.getUTCMonth()).toBe(7);
      expect(parseTurkishLongDate('1 Eylül 2026')?.getUTCMonth()).toBe(8);
      expect(parseTurkishLongDate('1 Ekim 2026')?.getUTCMonth()).toBe(9);
      expect(parseTurkishLongDate('1 Kasım 2026')?.getUTCMonth()).toBe(10);
      expect(parseTurkishLongDate('1 Aralık 2026')?.getUTCMonth()).toBe(11);
    });

    it('returns null for nonsense', () => {
      expect(parseTurkishLongDate('')).toBeNull();
      expect(parseTurkishLongDate('not a date')).toBeNull();
      expect(parseTurkishLongDate(null)).toBeNull();
    });
  });

  describe('parseDottedDate', () => {
    it('parses DD.MM.YYYY', () => {
      const d = parseDottedDate('04.04.2026');
      expect(d?.toISOString().slice(0, 10)).toBe('2026-04-04');
    });

    it('rejects non-matching strings', () => {
      expect(parseDottedDate('2026-04-04')).toBeNull();
      expect(parseDottedDate('04/04/2026')).toBeNull();
      expect(parseDottedDate('')).toBeNull();
    });
  });

  describe('extractIncidentDate', () => {
    it('prefers the "İhlalin ... tarihinde başladığı" start date', () => {
      const d = extractIncidentDate(
        'İhlalin 04.04.2026 tarihinde başladığı ve 12.04.2026 tarihinde tespit edildiği,',
      );
      expect(d?.toISOString().slice(0, 10)).toBe('2026-04-04');
    });

    it('falls back to the "tespit edildiği" detection date', () => {
      const d = extractIncidentDate('Olayın 09.03.2026 tarihinde tespit edildiği,');
      expect(d?.toISOString().slice(0, 10)).toBe('2026-03-09');
    });

    it('falls back to any DD.MM.YYYY occurrence', () => {
      const d = extractIncidentDate('Bir tarih: 01.02.2025 metninde.');
      expect(d?.toISOString().slice(0, 10)).toBe('2025-02-01');
    });

    it('returns null when nothing matches', () => {
      expect(extractIncidentDate('no dates here')).toBeNull();
    });
  });

  describe('extractDates (back-compat)', () => {
    it('parses a Turkish listing date as publicationDate', () => {
      const r = extractDates('İhlalin 01.01.2024 tarihinde başladığı', '15 Nisan 2026, Çarşamba');
      expect(r.publicationDate?.toISOString().slice(0, 10)).toBe('2026-04-15');
      expect(r.incidentDate?.toISOString().slice(0, 10)).toBe('2024-01-01');
    });

    it('returns null incidentDate when no date matches body', () => {
      const r = extractDates('no dates', null);
      expect(r.incidentDate).toBeNull();
      expect(r.publicationDate).toBeNull();
    });
  });

  describe('extractPostId', () => {
    it('extracts the numeric id from an /Icerik/{id}/slug URL', () => {
      expect(
        extractPostId(
          'https://www.kvkk.gov.tr/Icerik/8733/kamuoyu-duyurusu-veri-ihlali-bildirimi',
        ),
      ).toBe('8733');
    });

    it('returns null for unrelated URLs', () => {
      expect(extractPostId('https://www.kvkk.gov.tr/veri-ihlali-bildirimi/?page=1')).toBeNull();
    });
  });
});
