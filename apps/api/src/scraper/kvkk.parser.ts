import { load } from 'cheerio';
import type { HtmlResponse, ListingPage } from '@kvkk/shared';
import type { ParsedPost } from '@kvkk/shared';

const TURKISH_MONTHS: Record<string, string> = {
  ocak: '01',
  şubat: '02',
  mart: '03',
  nisan: '04',
  mayıs: '05',
  haziran: '06',
  temmuz: '07',
  ağustos: '08',
  eylül: '09',
  ekim: '10',
  kasım: '11',
  aralık: '12',
};

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  if (href.startsWith('/')) {
    const url = new URL(baseUrl);
    return `${url.protocol}//${url.host}${href}`;
  }
  return `https://www.kvkk.gov.tr${href}`;
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  const trimmed = dateStr.trim();

  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch {
    // Fall through
  }

  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    if (!day || !month || !year) return null;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }

  return null;
}

export function parseListingPage(html: HtmlResponse): ListingPage {
  const $ = load(html.body);
  const postUrls: string[] = [];

  const mainPost = $('.blog-post-container a').first();
  if (mainPost.length) {
    const href = mainPost.attr('href');
    if (href) {
      postUrls.push(resolveUrl(href, html.url));
    }
  }

  $('.blog-grid-title a').each((_, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      postUrls.push(resolveUrl(href, html.url));
    }
  });

  const pageUrlObj = new URL(html.url);
  const pageParam = pageUrlObj.searchParams.get('page');
  const pageNumber = pageParam ? parseInt(pageParam) : 1;

  const hasNextBtn = $('a:contains("→")').length > 0 || $('a[href*="page="]').filter((_, el) => {
    const href = $(el).attr('href') || '';
    const nextPageNum = new URL(href, html.url).searchParams.get('page');
    return !!(nextPageNum && parseInt(nextPageNum) > pageNumber);
  }).length > 0;

  return {
    pageUrl: html.url,
    pageNumber,
    postUrls,
    hasNext: hasNextBtn,
  };
}

export function parsePostPage(html: HtmlResponse): ParsedPost {
  const $ = load(html.body);

  // Try specific KVKK blog container first, then fall back to generic selectors
  let postContainer = $('.blog-post-inner');
  let titleElement = postContainer.find('.blog-post-title');

  // Fall back to generic selectors if specific container not found
  if (postContainer.length === 0 || titleElement.length === 0) {
    const genericTitle = $('h1').first();
    if (genericTitle.length === 0) {
      throw new Error('PARSE_FAILED: post container missing');
    }
    let title = genericTitle.text().trim();
    title = title.replace(/^Kamuoyu Duyurusu \(Veri İhlali Bildirimi\) [–-] /, '').trim();
    const content = $('body').text().trim();
    const dates = extractDates(content, null);
    return {
      sourceUrl: html.url,
      title,
      content,
      publicationDate: dates.publicationDate,
      incidentDate: dates.incidentDate,
    };
  }

  let title = titleElement.text().trim();
  title = title.replace(/^Kamuoyu Duyurusu \(Veri İhlali Bildirimi\) [–-] /, '').trim();

  const content = postContainer.text().trim();

  const dates = extractDates(content, null);

  return {
    sourceUrl: html.url,
    title,
    content,
    publicationDate: dates.publicationDate,
    incidentDate: dates.incidentDate,
  };
}

export function extractDates(
  body: string,
  listingDate: string | null,
): { publicationDate: Date | null; incidentDate: Date | null } {
  let publicationDate: Date | null = null;

  if (listingDate) {
    publicationDate = parseDate(listingDate);
  }

  let incidentDate: Date | null = null;

  const ddmmyyyyRegex = /(\d{1,2})[./](\d{1,2})[./](\d{4})/;
  const ddmmyyyyMatch = body.match(ddmmyyyyRegex);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    if (!day || !month || !year) return { publicationDate, incidentDate };
    incidentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!publicationDate) {
      publicationDate = incidentDate;
    }
    return { publicationDate, incidentDate };
  }

  const turkishDateRegex = /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{4})/i;
  const turkishMatch = body.match(turkishDateRegex);
  if (turkishMatch) {
    const [, day, monthName, year] = turkishMatch;
    if (!day || !monthName || !year) return { publicationDate, incidentDate };
    const month = TURKISH_MONTHS[monthName.toLowerCase()];
    if (month) {
      incidentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!publicationDate) {
        publicationDate = incidentDate;
      }
    }
  }

  return { publicationDate, incidentDate };
}
