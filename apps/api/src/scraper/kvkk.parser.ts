import { load } from 'cheerio';
import type { HtmlResponse, ListingPage, ParsedPost } from '@kvkk/shared';

const TURKISH_MONTHS: Record<string, number> = {
  ocak: 1,
  şubat: 2,
  mart: 3,
  nisan: 4,
  mayıs: 5,
  haziran: 6,
  temmuz: 7,
  ağustos: 8,
  eylül: 9,
  ekim: 10,
  kasım: 11,
  aralık: 12,
};

/**
 * Resolve a possibly-relative URL against the page base.
 */
function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    if (href.startsWith('/')) return `https://www.kvkk.gov.tr${href}`;
    return href;
  }
}

/**
 * Parse Turkish long-form dates like "15 Nisan 2026, Çarşamba" or "15 Nisan 2026".
 * Returns null on failure.
 */
export function parseTurkishLongDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(
    /(\d{1,2})\s+(Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık)\s+(\d{4})/i,
  );
  if (!match) return null;
  const [, dayStr, monthName, yearStr] = match;
  if (!dayStr || !monthName || !yearStr) return null;
  const month = TURKISH_MONTHS[monthName.toLocaleLowerCase('tr-TR')];
  if (!month) return null;
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  if (!day || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Parse DD.MM.YYYY — used for inline incident/detection dates in the article body.
 */
export function parseDottedDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const match = input.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, dayStr, monthStr, yearStr] = match;
  const day = parseInt(dayStr!, 10);
  const month = parseInt(monthStr!, 10);
  const year = parseInt(yearStr!, 10);
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Extract the numeric post id from a /Icerik/{id}/slug URL path.
 */
export function extractPostId(url: string): string | null {
  const match = url.match(/\/Icerik\/(\d+)\//i);
  return match ? match[1]! : null;
}

/**
 * Parse the /veri-ihlali-bildirimi listing page against the current markup:
 *   .news__box > .news__box-meta > a (title + href)
 *   .news__box > .news__box-meta > p.date
 *   .pagination li.page-item a[href*="page="]
 */
export function parseListingPage(html: HtmlResponse): ListingPage {
  const $ = load(html.body);
  const postUrls: string[] = [];

  $('.news__box').each((_, elem) => {
    // Prefer the meta anchor; fall back to the image anchor.
    const metaAnchor = $(elem).find('.news__box-meta > a[href]').first();
    const anchor = metaAnchor.length
      ? metaAnchor
      : $(elem).find('a[href]').first();
    const href = anchor.attr('href');
    if (!href) return;
    const absolute = resolveUrl(href, html.url);
    if (!postUrls.includes(absolute)) {
      postUrls.push(absolute);
    }
  });

  // Current page number: from URL or from .pagination .active
  const pageUrlObj = (() => {
    try {
      return new URL(html.url);
    } catch {
      return null;
    }
  })();
  const pageParam = pageUrlObj?.searchParams.get('page');
  let pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
  if (!pageNumber || Number.isNaN(pageNumber)) pageNumber = 1;

  const activeLink = $('.pagination li.page-item.active a[href]').first();
  if (activeLink.length) {
    const n = extractPageParam(activeLink.attr('href') || '');
    if (n) pageNumber = n;
  }

  // Total pages: max page= in any pagination anchor.
  let totalPages = 1;
  $('.pagination li.page-item a[href]').each((_, el) => {
    const n = extractPageParam($(el).attr('href') || '');
    if (n && n > totalPages) totalPages = n;
  });
  if (totalPages < pageNumber) totalPages = pageNumber;

  // hasNext: a "next" link that points to a page greater than the current one.
  let hasNext = false;
  const nextAnchor = $('.pagination li.page-item.next a[href]').first();
  if (nextAnchor.length) {
    const n = extractPageParam(nextAnchor.attr('href') || '');
    if (n && n > pageNumber) hasNext = true;
  }
  if (!hasNext && pageNumber < totalPages) {
    hasNext = true;
  }

  return {
    pageUrl: html.url,
    pageNumber,
    postUrls,
    hasNext,
  };
}

function extractPageParam(href: string): number | null {
  if (!href) return null;
  try {
    const u = new URL(href, 'https://www.kvkk.gov.tr');
    const p = u.searchParams.get('page');
    if (!p) return null;
    const n = parseInt(p, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    const match = href.match(/[?&]page=(\d+)/);
    return match ? parseInt(match[1]!, 10) : null;
  }
}

/**
 * Serialize the article block to plain text, preserving paragraph / list breaks.
 */
function serializeArticle($: ReturnType<typeof load>, articleEl: any): string {
  const lines: string[] = [];

  articleEl.children().each((_: number, child: any) => {
    const $child = $(child);
    const tag = (child as any).tagName?.toLowerCase?.() ?? '';
    if (tag === 'h2') return; // title handled separately
    if (tag === 'ul' || tag === 'ol') {
      $child.children('li').each((__: number, li: any) => {
        const text = $(li).text().replace(/\s+/g, ' ').trim();
        if (text) lines.push(`- ${text}`);
      });
      return;
    }
    const text = $child.text().replace(/\s+/g, ' ').trim();
    if (text) lines.push(text);
  });

  if (lines.length === 0) {
    // Fallback: raw text of article.
    const fallback = articleEl.text().replace(/\s+/g, ' ').trim();
    return fallback;
  }

  return lines.join('\n\n');
}

/**
 * Parse a detail page /Icerik/{id}/{slug}.
 * Selectors:
 *   title:   .news__detail-article-title  (fallback .breadcrumb-item.active)
 *   date:    .news__detail-head-meta div > span:not(.title)
 *   article: .news__detail-article (minus <h2>)
 */
export function parsePostPage(html: HtmlResponse): ParsedPost {
  const $ = load(html.body);

  const articleEl = $('.news__detail-article').first();
  const titleEl = articleEl.find('.news__detail-article-title').first();

  let title = titleEl.text().replace(/\s+/g, ' ').trim();
  if (!title) {
    title = $('.breadcrumb-item.active').first().text().replace(/\s+/g, ' ').trim();
  }
  if (!title) {
    title = $('h1').first().text().replace(/\s+/g, ' ').trim();
  }

  if (!title) {
    throw new Error('PARSE_FAILED: title missing');
  }

  // Publication date — first span without class="title" inside news__detail-head-meta
  let publicationDateText: string | null = null;
  $('.news__detail-head-meta div > span').each((_, el) => {
    if (publicationDateText) return;
    const $el = $(el);
    if ($el.hasClass('title')) return;
    const text = $el.text().trim();
    if (text) publicationDateText = text;
  });
  const publicationDate = parseTurkishLongDate(publicationDateText);

  // Body content (article minus the h2 title).
  let content = '';
  if (articleEl.length) {
    content = serializeArticle($, articleEl);
  } else {
    content = $('main').text().replace(/\s+/g, ' ').trim();
  }

  // Incident / detection dates from body text.
  const incidentDate = extractIncidentDate(content);

  return {
    sourceUrl: html.url,
    title,
    content,
    publicationDate,
    incidentDate,
  };
}

/**
 * Find the "İhlalin DD.MM.YYYY tarihinde başladığı" date, falling back to the
 * "DD.MM.YYYY tarihinde tespit edildiği" detection date, then any DD.MM.YYYY
 * found in the body.
 */
export function extractIncidentDate(body: string): Date | null {
  if (!body) return null;

  const startedMatch = body.match(/İhlalin\s+(\d{2}\.\d{2}\.\d{4})\s+tarihinde\s+başladığı/iu);
  if (startedMatch) {
    const d = parseDottedDate(startedMatch[1]!);
    if (d) return d;
  }

  const detectedMatch = body.match(/(\d{2}\.\d{2}\.\d{4})\s+tarihinde\s+tespit\s+edildiği/iu);
  if (detectedMatch) {
    const d = parseDottedDate(detectedMatch[1]!);
    if (d) return d;
  }

  const anyDot = body.match(/\b(\d{2}\.\d{2}\.\d{4})\b/);
  if (anyDot) {
    const d = parseDottedDate(anyDot[1]!);
    if (d) return d;
  }

  return null;
}

/**
 * Back-compat helper preserved for the spec. Returns publicationDate (from
 * optional listing-provided string) and incidentDate (best-effort from body).
 */
export function extractDates(
  body: string,
  listingDate: string | null,
): { publicationDate: Date | null; incidentDate: Date | null } {
  const publicationDate =
    parseTurkishLongDate(listingDate) ?? (listingDate ? parseDottedDate(listingDate.trim()) : null);
  const incidentDate = extractIncidentDate(body);
  return { publicationDate, incidentDate };
}
