import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAliceProjectUrl,
  buildProjectMemberAddedEmail,
  createResendProjectMemberEmailSender,
} from '../../src/routes/api/projects/project-member-email';

const notificationEventId = '11111111-1111-4111-8111-111111111111';
type FetchInput = string | URL | Request;

function buildMessage() {
  return buildProjectMemberAddedEmail({
    recipientEmail: 'member@example.com',
    recipientName: 'Taylor',
    projectId: '33333333-3333-4333-8333-333333333333',
    projectName: 'Apollo',
    frontendUrl: 'https://alice.example',
    notificationEventId,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('project member email template', () => {
  it('builds a professional message from the configured Alice origin', () => {
    const message = buildProjectMemberAddedEmail({
      recipientEmail: 'member@example.com',
      recipientName: 'Taylor',
      projectId: '33333333-3333-4333-8333-333333333333',
      projectName: 'Apollo',
      frontendUrl:
        'https://alice.example/configured/path?token=secret#fragment',
      notificationEventId,
    });

    expect(message).toEqual(
      expect.objectContaining({
        to: 'member@example.com',
        subject: "You've been added to Apollo in Alice",
      })
    );
    expect(message.text).toContain(
      'https://alice.example/projects/33333333-3333-4333-8333-333333333333'
    );
    expect(message.html).toContain('Open project');
    expect(message.text).not.toContain('token=secret');
  });

  it('escapes untrusted display values and strips header newlines', () => {
    const message = buildProjectMemberAddedEmail({
      recipientEmail: 'member@example.com',
      recipientName: '<Taylor>',
      projectId: 'project-1',
      projectName: 'Apollo\r\nBcc: attacker@example.com <script>',
      frontendUrl: 'https://alice.example',
      notificationEventId,
    });

    expect(message.subject).toBe(
      "You've been added to Apollo Bcc: attacker@example.com <script> in Alice"
    );
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.html).toContain('&lt;Taylor&gt;');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).not.toContain('<script>');
  });

  it('rejects unsafe frontend URLs and recipient header injection', () => {
    expect(() =>
      buildAliceProjectUrl('javascript:alert(1)', 'project-1')
    ).toThrow('Alice frontend URL must use HTTP or HTTPS.');
    expect(() =>
      buildAliceProjectUrl('https://user:password@alice.example', 'project-1')
    ).toThrow('Alice frontend URL must not contain credentials.');
    expect(() =>
      buildAliceProjectUrl('http://alice.example', 'project-1')
    ).toThrow('Alice frontend URL must use HTTPS outside local development.');
    expect(() =>
      buildProjectMemberAddedEmail({
        recipientEmail: 'member@example.com\r\nBcc: attacker@example.com',
        recipientName: 'Taylor',
        projectId: 'project-1',
        projectName: 'Apollo',
        frontendUrl: 'https://alice.example',
        notificationEventId,
      })
    ).toThrow('Recipient email is invalid.');
  });
});

describe('Resend project member email sender', () => {
  it('posts the existing template with authorization and event idempotency', async () => {
    const fetchMock = vi.fn(
      async (_input: FetchInput, _init?: RequestInit) =>
        new Response(null, { status: 202 })
    );
    const sender = createResendProjectMemberEmailSender({
      apiKey: 'test-resend-api-key',
      from: 'Alice <notifications@example.com>',
      fetchImplementation: fetchMock as typeof fetch,
    });

    await sender.send(buildMessage());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-resend-api-key',
          'Content-Type': 'application/json',
          'Idempotency-Key': `project-member-added:${notificationEventId}`,
        }),
        signal: expect.any(AbortSignal),
      })
    );
    expect(JSON.parse(String(init?.body))).toEqual(
      expect.objectContaining({
        from: 'Alice <notifications@example.com>',
        to: ['member@example.com'],
        subject: "You've been added to Apollo in Alice",
      })
    );
  });

  it('reuses the same idempotency key when the same event is retried', async () => {
    const fetchMock = vi.fn(
      async (_input: FetchInput, _init?: RequestInit) =>
        new Response(null, { status: 202 })
    );
    const sender = createResendProjectMemberEmailSender({
      apiKey: 'test-resend-api-key',
      from: 'notifications@example.com',
      fetchImplementation: fetchMock as typeof fetch,
    });
    const message = buildMessage();

    await sender.send(message);
    await sender.send(message);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers;
    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers;
    expect(firstHeaders).toMatchObject({
      'Idempotency-Key': `project-member-added:${notificationEventId}`,
    });
    expect(secondHeaders).toEqual(firstHeaders);
  });

  it('fails safely on provider errors without reading provider response data', async () => {
    const text = vi.fn(async () => 'recipient member@example.com rejected');
    const fetchMock = vi.fn(async () => ({ ok: false, status: 429, text }));
    const sender = createResendProjectMemberEmailSender({
      apiKey: 'test-resend-api-key',
      from: 'notifications@example.com',
      fetchImplementation: fetchMock as unknown as typeof fetch,
    });

    await expect(sender.send(buildMessage())).rejects.toThrow(
      'Resend email request failed with status 429.'
    );
    expect(text).not.toHaveBeenCalled();
  });

  it('aborts a request at the configured timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (_url: FetchInput, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        })
    );
    const sender = createResendProjectMemberEmailSender({
      apiKey: 'test-resend-api-key',
      from: 'notifications@example.com',
      timeoutMs: 50,
      fetchImplementation: fetchMock as typeof fetch,
    });

    const rejection = expect(sender.send(buildMessage())).rejects.toThrow(
      'Resend email request timed out.'
    );
    await vi.advanceTimersByTimeAsync(50);
    await rejection;
  });

  it('skips delivery safely when either required setting is missing', async () => {
    const fetchMock = vi.fn();
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missingApiKey = createResendProjectMemberEmailSender({
      from: 'notifications@example.com',
      fetchImplementation: fetchMock as typeof fetch,
    });
    const missingFrom = createResendProjectMemberEmailSender({
      apiKey: 'test-resend-api-key',
      fetchImplementation: fetchMock as typeof fetch,
    });
    const blankSettings = createResendProjectMemberEmailSender({
      apiKey: '   ',
      from: '',
      fetchImplementation: fetchMock as typeof fetch,
    });

    await missingApiKey.send(buildMessage());
    await missingFrom.send(buildMessage());
    await blankSettings.send(buildMessage());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledTimes(3);
    expect(consoleWarn).toHaveBeenCalledWith(
      'warn. project member email delivery skipped; Resend is not configured'
    );
  });
});
