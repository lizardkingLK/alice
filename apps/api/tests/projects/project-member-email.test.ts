import { describe, expect, it } from 'vitest';
import {
  buildAliceProjectUrl,
  buildProjectMemberAddedEmail,
} from '../../src/routes/api/projects/project-member-email';

describe('project member email template', () => {
  it('builds a professional message from the configured Alice origin', () => {
    const message = buildProjectMemberAddedEmail({
      recipientEmail: 'member@example.com',
      recipientName: 'Taylor',
      projectId: '33333333-3333-4333-8333-333333333333',
      projectName: 'Apollo',
      frontendUrl:
        'https://alice.example/configured/path?token=secret#fragment',
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
      })
    ).toThrow('Recipient email is invalid.');
  });
});
