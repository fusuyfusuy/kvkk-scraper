import type { EmailTemplateData } from '@kvkk/shared';

export function renderBreachEmail(data: EmailTemplateData): { subject: string; html: string; text: string } {
  const excerpt = data.bodyExcerpt.substring(0, 400);
  const publicationDateStr = data.publicationDate
    ? new Date(data.publicationDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown date';

  const subject = `KVKK Breach Notification: ${data.title}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f44336; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
    .content { background: #f9f9f9; padding: 20px; border-left: 4px solid #f44336; margin-bottom: 20px; }
    .section { margin-bottom: 16px; }
    .label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .value { margin-bottom: 16px; }
    .excerpt { background: white; padding: 12px; border-radius: 4px; font-style: italic; color: #555; margin: 12px 0; }
    .cta { display: inline-block; background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px; }
    .footer { font-size: 12px; color: #999; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">KVKK Breach Notification</h1>
    </div>

    <div class="content">
      <div class="section">
        <div class="label">Incident Title</div>
        <div class="value">${escapeHtml(data.title)}</div>
      </div>

      <div class="section">
        <div class="label">Publication Date</div>
        <div class="value">${escapeHtml(publicationDateStr)}</div>
      </div>

      <div class="section">
        <div class="label">Source</div>
        <div class="value"><a href="${escapeHtml(data.sourceUrl)}" style="color: #2196F3;">${escapeHtml(data.sourceUrl)}</a></div>
      </div>

      <div class="section">
        <div class="label">Excerpt</div>
        <div class="excerpt">${escapeHtml(excerpt)}${data.bodyExcerpt.length > 400 ? '...' : ''}</div>
      </div>

      <a href="${escapeHtml(data.sourceUrl)}" class="cta">Read Full Notification</a>
    </div>

    <div class="footer">
      <p>This is an automated notification from KVKK Scraper. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `KVKK BREACH NOTIFICATION
========================

Title: ${data.title}

Publication Date: ${publicationDateStr}

Source: ${data.sourceUrl}

Excerpt:
${excerpt}${data.bodyExcerpt.length > 400 ? '...' : ''}

Read full notification at: ${data.sourceUrl}

---
This is an automated notification from KVKK Scraper. Please do not reply to this email.`;

  return { subject, html, text };
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
