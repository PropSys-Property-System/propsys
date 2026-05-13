import { describe, expect, it } from 'vitest';
import { renderInvitationEmailHtml, renderPasswordResetEmailHtml } from './templates';

describe('email template rendering', () => {
  it('escapes invitation email HTML values before interpolation', () => {
    const html = renderInvitationEmailHtml({
      name: '<img src=x onerror=alert(1)>',
      inviteLink: 'https://app.propsys.test/invitations/accept?token=abc&next="><script>',
      internalRole: 'OWNER',
      expiresAt: '2026-05-13T12:00:00.000Z',
    });

    expect(html).toContain('Hola &lt;img src=x onerror=alert(1)&gt;,');
    expect(html).toContain('https://app.propsys.test/invitations/accept?token=abc&amp;next=&quot;&gt;&lt;script&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('"><script>');
  });

  it('escapes password reset links in href and visible text', () => {
    const html = renderPasswordResetEmailHtml({
      resetLink: 'https://app.propsys.test/reset-password?token=abc&next="><script>',
      expiresAt: '2026-05-13T12:00:00.000Z',
    });

    expect(html).toContain('https://app.propsys.test/reset-password?token=abc&amp;next=&quot;&gt;&lt;script&gt;');
    expect(html).not.toContain('"><script>');
  });
});
