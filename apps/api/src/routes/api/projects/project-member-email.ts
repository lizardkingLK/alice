export type ProjectMemberEmailMessage = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
};

export type ProjectMemberEmailSender = {
  send(message: ProjectMemberEmailMessage): Promise<void>;
};

type ProjectMemberEmailInput = {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly frontendUrl: string;
};

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

export function buildAliceProjectUrl(
  frontendUrl: string,
  projectId: string
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

  return new URL(
    `/projects/${encodeURIComponent(projectId)}`,
    configuredUrl.origin
  ).toString();
}

export function buildProjectMemberAddedEmail(
  input: ProjectMemberEmailInput
): ProjectMemberEmailMessage {
  const to = normalizeRecipientEmail(input.recipientEmail);
  const recipientName = normalizeDisplayText(input.recipientName, 'there');
  const projectName = normalizeDisplayText(input.projectName, 'your project');
  const projectUrl = buildAliceProjectUrl(input.frontendUrl, input.projectId);
  const subject = `You've been added to ${projectName} in Alice`;

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

  return { to, subject, text, html };
}

/**
 * Delivery boundary for Phase 2. No approved custom transactional provider is
 * configured yet, so production intentionally performs no external delivery.
 */
export const boundaryOnlyProjectMemberEmailSender: ProjectMemberEmailSender = {
  send: () => Promise.resolve(),
};
