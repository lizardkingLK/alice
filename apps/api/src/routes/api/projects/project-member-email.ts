import {
  EmailTransportError,
  type EmailMessage,
  type EmailTransport,
} from '../../../lib/email/email-transport';
import {
  buildValidatedFrontendUrl,
  escapeEmailHtml,
  normalizeEmailAddress,
  normalizeEmailDisplayText,
} from '../../../lib/email/email-content';
import { buildEmailIdempotencyKey } from '../../../lib/email/email-delivery-policy';

export type ProjectMemberEmailMessage = EmailMessage;
export type ProjectMemberEmailSender = EmailTransport;

type ProjectMemberEmailInput = {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly projectId: string;
  readonly projectName: string;
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

export function buildAliceProjectUrl(
  frontendUrl: string,
  projectId: string
): string {
  return buildValidatedFrontendUrl(frontendUrl, ['projects', projectId]);
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
  const projectUrl = buildAliceProjectUrl(input.frontendUrl, input.projectId);
  const subject = `You've been added to ${projectName} in Alice`;
  const idempotencyKey = buildEmailIdempotencyKey(
    'project-member-added',
    input.notificationEventId
  );

  const text = [
    `Hello ${recipientName},`,
    '',
    `You've been added to the ${projectName} project in Alice.`,
    `Open project: ${projectUrl}`,
    '',
    "If you weren't expecting this, contact your Alice administrator.",
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f7f9;color:#1f2937;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px">
        <h1 style="margin:0 0 20px;font-size:24px">Project access added</h1>
        <p>Hello ${escapeEmailHtml(recipientName)},</p>
        <p>You've been added to the <strong>${escapeEmailHtml(projectName)}</strong> project in Alice.</p>
        <p style="margin:28px 0">
          <a href="${escapeEmailHtml(projectUrl)}" style="display:inline-block;border-radius:8px;background:#111827;color:#ffffff;padding:12px 18px;text-decoration:none">Open project</a>
        </p>
        <p style="margin-bottom:0;color:#6b7280;font-size:14px">If you weren't expecting this, contact your Alice administrator.</p>
      </div>
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
