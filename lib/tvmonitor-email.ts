/**
 * Magic-link email delivery for the TV Monitor studio.
 *
 * Uses Resend's HTTP API when RESEND_API_KEY is configured. When it isn't,
 * sending is reported as unavailable — the admin UI falls back to copyable
 * invite links, so the feature degrades gracefully instead of breaking.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function isStudioEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendStudioLoginEmail(to: string, loginUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.TVMONITOR_EMAIL_FROM || 'Bond Sports <no-reply@bondsports.co>';

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'Your Bond TV Monitor Studio sign-in link',
        html: [
          '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">',
          '<h2 style="color:#0d4774;margin:0 0 12px;">TV Monitor Studio</h2>',
          '<p style="color:#374151;line-height:1.5;">Click the button below to sign in. This link works once and expires in 15 minutes.</p>',
          `<p style="margin:24px 0;"><a href="${loginUrl}" style="background:#0d4774;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">Sign in to the studio</a></p>`,
          '<p style="color:#6b7280;font-size:13px;line-height:1.5;">If you did not request this, you can ignore this email.</p>',
          '</div>',
        ].join(''),
      }),
    });
    if (!response.ok) {
      console.error('[TvMonitorEmail] Resend error:', response.status, await response.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.error('[TvMonitorEmail] send failed:', error);
    return false;
  }
}
