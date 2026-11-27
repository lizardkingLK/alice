import {
  EmailTransportError,
  type EmailMessage,
  type EmailTransport,
} from '../../../lib/email/email-transport';
import {
  buildAliceBrandLogoUrl,
  buildValidatedFrontendUrl,
  escapeEmailHtml,
  normalizeEmailAddress,
  normalizeEmailDisplayText,
  sanitizeEmailImageUrl,
} from '../../../lib/email/email-content';
import { buildEmailIdempotencyKey } from '../../../lib/email/email-delivery-policy';

export type ProjectMemberEmailMessage = EmailMessage;
export type ProjectMemberEmailSender = EmailTransport;

type ProjectMemberEmailInput = {
  readonly recipientEmail: string;
  readonly recipientName: string;
  /** Shareable project KEY for `/projects/{KEY}` links (not UUID). */
  readonly projectKey: string;
  readonly projectName: string;
  /** Public project logo URL when set; omitted or invalid values hide the image. */
  readonly projectLogoUrl?: string | null;
  readonly frontendUrl: string;
  readonly notificationEventId: string;
};

export type ResendEmailTransportConfig = {
  readonly apiKey?: string;
  readonly from?: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
  readonly missingConfiguration?: 'skip' | 'throw';
};

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 5_000;
function validResendSetting(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || /[\r\n]/.test(normalized)) {
    return null;
  }
  return normalized;
}

/** Canonical in-app project path segment: uppercase KEY when it looks like one. */
function projectPathSegment(projectKey: string): string {
  const trimmed = projectKey.trim();
  if (/^[A-Z0-9]{2,10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export function buildAliceProjectUrl(
  frontendUrl: string,
  projectKey: string
): string {
  const segment = projectPathSegment(projectKey);
  if (!segment) {
    throw new Error('Project key is required.');
  }
  return buildValidatedFrontendUrl(frontendUrl, ['projects', segment]);
}

function projectInitial(projectName: string): string {
  const letter = projectName.trim().charAt(0);
  return (letter || 'P').toUpperCase();
}

export function buildProjectMemberAddedEmail(
  input: ProjectMemberEmailInput
): ProjectMemberEmailMessage {
  const to = normalizeEmailAddress(input.recipientEmail);
  const recipientName = normalizeEmailDisplayText(input.recipientName, 'there');
  const projectName = normalizeEmailDisplayText(
    input.projectName,
    'your project'
  );
  const projectKeyLabel = projectPathSegment(input.projectKey);
  const projectUrl = buildAliceProjectUrl(input.frontendUrl, input.projectKey);
  const brandLogoUrl = buildAliceBrandLogoUrl(input.frontendUrl);
  const projectLogoUrl = sanitizeEmailImageUrl(input.projectLogoUrl);
  const subject = `Added to ${projectName} on Alice`;
  const idempotencyKey = buildEmailIdempotencyKey(
    'project-member-added',
    input.notificationEventId
  );

  const text = [
    `Hello ${recipientName},`,
    '',
    `You've been added to the ${projectName} project (${projectKeyLabel}) in Alice.`,
    `Open project: ${projectUrl}`,
    '',
    "If you weren't expecting this, contact your Alice administrator.",
  ].join('\n');

  const projectLogoHtml = projectLogoUrl
    ? `<img src="${escapeEmailHtml(projectLogoUrl)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:10px;object-fit:cover;border:1px solid #e5e7eb" />`
    : `<div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#2db872 0%,#088242 100%);color:#ffffff;font-family:Arial,sans-serif;font-size:20px;font-weight:700;line-height:48px;text-align:center">${escapeEmailHtml(projectInitial(projectName))}</div>`;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4fbf7;color:#1f2937;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="margin:0 0 16px;text-align:left">
        <img src="${escapeEmailHtml(brandLogoUrl)}" width="40" height="40" alt="Alice" style="display:inline-block;width:40px;height:40px;border-radius:10px;vertical-align:middle" />
        <span style="display:inline-block;margin-left:10px;font-size:18px;font-weight:700;color:#0f172a;vertical-align:middle">Alice</span>
      </div>
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:28px 32px;box-shadow:0 1px 2px rgba(15,23,42,0.04)">
        <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0f172a">Project access added</h1>
        <p style="margin:0 0 24px;color:#64748b;font-size:14px">You now have access to this workspace project.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;border-collapse:collapse">
          <tr>
            <td style="width:48px;vertical-align:middle;padding:0 14px 0 0">
              ${projectLogoHtml}
            </td>
            <td style="vertical-align:middle;padding:0">
              <div style="font-size:16px;font-weight:700;color:#0f172a;line-height:1.3">${escapeEmailHtml(projectName)}</div>
              <div style="margin-top:4px;font-size:13px;color:#64748b;letter-spacing:0.02em">${escapeEmailHtml(projectKeyLabel)}</div>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px">Hello ${escapeEmailHtml(recipientName)},</p>
        <p style="margin:0 0 28px;line-height:1.5">You've been added to <strong>${escapeEmailHtml(projectName)}</strong> in Alice. Open the project to see work items, sprints, and your team.</p>
        <p style="margin:0 0 28px">
          <a href="${escapeEmailHtml(projectUrl)}" style="display:inline-block;border-radius:8px;background:#088242;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:600">Open project</a>
        </p>
        <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.45">If you weren't expecting this, contact your Alice administrator.</p>
      </div>
      <p style="margin:20px 0 0;text-align:center;color:#94a3b8;font-size:12px">Sent by Alice</p>
    </div>
  </body>
</html>`;

  return { to, subject, text, html, idempotencyKey };
}

export function createResendEmailTransport(
  config: ResendEmailTransportConfig
): EmailTransport {
  const apiKey = validResendSetting(config.apiKey);
  const from = validResendSetting(config.from);
  const timeoutMs = config.timeoutMs ?? RESEND_TIMEOUT_MS;
  const fetchImplementation = config.fetchImplementation ?? globalThis.fetch;

  return {
    async send(message) {
      if (!apiKey || !from) {
        if (config.missingConfiguration !== 'skip') {
          throw new EmailTransportError(
            'Resend email delivery is not configured.',
            { kind: 'configuration' }
          );
        }
        console.warn(
          'warn. project member email delivery skipped; Resend is not configured'
        );
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImplementation(RESEND_EMAILS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': message.idempotencyKey,
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new EmailTransportError(
            `Resend email request failed with status ${response.status}.`,
            { kind: 'http', status: response.status }
          );
        }
      } catch (error) {
        if (controller.signal.aborted) {
          throw new EmailTransportError('Resend email request timed out.', {
            kind: 'timeout',
          });
        }
        if (error instanceof EmailTransportError) {
          throw error;
        }
        throw new EmailTransportError('Resend email request failed.', {
          kind: 'network',
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createResendProjectMemberEmailSender(
  config: ResendEmailTransportConfig
): ProjectMemberEmailSender {
  return createResendEmailTransport({
    ...config,
    missingConfiguration: config.missingConfiguration ?? 'skip',
  });
}
