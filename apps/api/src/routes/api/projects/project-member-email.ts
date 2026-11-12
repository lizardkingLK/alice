export type ProjectMemberEmailMessage = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly idempotencyKey: string;
};

export type ProjectMemberEmailSender = {
  send(message: ProjectMemberEmailMessage): Promise<void>;
};

type ProjectMemberEmailInput = {
  readonly recipientEmail: string;
  readonly recipientName: string;
  /** Shareable project KEY for `/projects/{KEY}` links (not UUID). */
  readonly projectKey: string;
  readonly projectName: string;
  readonly frontendUrl: string;
  readonly notificationEventId: string;
};

type ResendProjectMemberEmailSenderConfig = {
  readonly apiKey?: string;
  readonly from?: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
};

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 5_000;
const SAFE_IDEMPOTENCY_COMPONENT = /^[A-Za-z0-9_-]{1,200}$/;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeDisplayText(value: string, fallback: string): string {
  const normalized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, 160);
}

function normalizeRecipientEmail(value: string): string {
  const normalized = value.trim();
  const atIndex = normalized.indexOf('@');
  const dotIndex = normalized.lastIndexOf('.');
  const hasWhitespace = [...normalized].some((character) =>
    [' ', '\t', '\r', '\n'].includes(character)
  );
  if (
    !normalized ||
    hasWhitespace ||
    atIndex <= 0 ||
    atIndex !== normalized.lastIndexOf('@') ||
    dotIndex <= atIndex + 1 ||
    dotIndex === normalized.length - 1
  ) {
    throw new Error('Recipient email is invalid.');
  }
  return normalized;
}

function buildProjectMemberIdempotencyKey(eventId: string): string {
  if (!SAFE_IDEMPOTENCY_COMPONENT.test(eventId)) {
    throw new Error('Project member notification event id is invalid.');
  }
  return `project-member-added:${eventId}`;
}

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
  let configuredUrl: URL;
  try {
    configuredUrl = new URL(frontendUrl);
  } catch {
    throw new Error('Alice frontend URL is invalid.');
  }

  if (!['http:', 'https:'].includes(configuredUrl.protocol)) {
    throw new Error('Alice frontend URL must use HTTP or HTTPS.');
  }
  const localHttpHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (
    configuredUrl.protocol === 'http:' &&
    !localHttpHosts.has(configuredUrl.hostname)
  ) {
    throw new Error(
      'Alice frontend URL must use HTTPS outside local development.'
    );
  }
  if (configuredUrl.username || configuredUrl.password) {
    throw new Error('Alice frontend URL must not contain credentials.');
  }

  const segment = projectPathSegment(projectKey);
  if (!segment) {
    throw new Error('Project key is required.');
  }

  return new URL(
    `/projects/${encodeURIComponent(segment)}`,
    configuredUrl.origin
  ).toString();
}

export function buildProjectMemberAddedEmail(
  input: ProjectMemberEmailInput
): ProjectMemberEmailMessage {
  const to = normalizeRecipientEmail(input.recipientEmail);
  const recipientName = normalizeDisplayText(input.recipientName, 'there');
  const projectName = normalizeDisplayText(input.projectName, 'your project');
  const projectUrl = buildAliceProjectUrl(input.frontendUrl, input.projectKey);
  const subject = `You've been added to ${projectName} in Alice`;
  const idempotencyKey = buildProjectMemberIdempotencyKey(
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
        <p>Hello ${escapeHtml(recipientName)},</p>
        <p>You've been added to the <strong>${escapeHtml(projectName)}</strong> project in Alice.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(projectUrl)}" style="display:inline-block;border-radius:8px;background:#111827;color:#ffffff;padding:12px 18px;text-decoration:none">Open project</a>
        </p>
        <p style="margin-bottom:0;color:#6b7280;font-size:14px">If you weren't expecting this, contact your Alice administrator.</p>
      </div>
    </div>
  </body>
</html>`;

  return { to, subject, text, html, idempotencyKey };
}

export function createResendProjectMemberEmailSender(
  config: ResendProjectMemberEmailSenderConfig
): ProjectMemberEmailSender {
  const apiKey = validResendSetting(config.apiKey);
  const from = validResendSetting(config.from);
  const timeoutMs = config.timeoutMs ?? RESEND_TIMEOUT_MS;
  const fetchImplementation = config.fetchImplementation ?? globalThis.fetch;

  return {
    async send(message) {
      if (!apiKey || !from) {
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
          throw new Error(
            `Resend email request failed with status ${response.status}.`
          );
        }
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error('Resend email request timed out.');
        }
        if (
          error instanceof Error &&
          error.message.startsWith('Resend email request failed with status ')
        ) {
          throw error;
        }
        throw new Error('Resend email request failed.');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
