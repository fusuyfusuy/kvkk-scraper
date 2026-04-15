import type { EmailTemplateData } from '@kvkk/shared';

// CONTRACT:
// Handlebars HTML email templates for breach notifications.
// renderBreachNotification: compiles template and returns HTML string.
// Subject line: "KVKK İhlal Bildirimi: {title}"

export function renderBreachNotification(data: EmailTemplateData): { subject: string; html: string } {
  // CONTRACT:
  // Input: EmailTemplateData (packages/shared/src/types/email.ts) — title, publicationDate, incidentDate, sourceUrl, bodyExcerpt
  // Output: { subject: string, html: string }
  // Logic:
  //   1. Compile Handlebars template (inline or from file)
  //   2. Format dates to Turkish locale (tr-TR)
  //   3. subject = `KVKK İhlal Bildirimi: ${data.title}`
  //   4. html = compiled template with data
  //   5. Return { subject, html }
  throw new Error('not implemented');
}
