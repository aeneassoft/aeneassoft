// [PRODUCTNAME] Email System — all emails via Resend
import { Resend } from 'resend';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.FROM_EMAIL || 'noreply@aeneassoft.com';
const DASHBOARD_URL = 'https://aeneassoft.com/dashboard';

// ── Welcome Email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, apiKey: string): Promise<void> {
  const resend = getResend();
  if (!resend) { console.log(`[PRODUCTNAME] Email (no Resend): Welcome → ${to}`); return; }

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Welcome to AeneasSoft',
    html: `
      <h2>Welcome to AeneasSoft</h2>
      <p>Your account is ready. Here's your API key:</p>
      <pre style="background:#0A1628;color:#00B4FF;padding:16px;border-radius:8px;font-size:14px;">${apiKey}</pre>
      <p><strong>Quickstart:</strong></p>
      <pre style="background:#0A1628;color:#F0A500;padding:16px;border-radius:8px;font-size:14px;">pip install aeneas-agentwatch
export AGENTWATCH_API_KEY=${apiKey}

import agentwatch
agentwatch.init()
# Every LLM call is now traced</pre>
      <p><a href="${DASHBOARD_URL}" style="color:#00B4FF;">Open Dashboard</a></p>
      <p style="color:#666;font-size:12px;">Questions? Reply to this email or contact support@aeneassoft.com</p>
    `,
  });
}

// ── Password Reset Email ─────────────────────────────────────────────────────

export async function sendResetPasswordEmail(to: string, resetToken: string): Promise<void> {
  const resend = getResend();
  const resetUrl = `https://aeneassoft.com/reset-password?token=${resetToken}`;
  if (!resend) { console.log(`[PRODUCTNAME] Email (no Resend): Reset → ${to} | ${resetUrl}`); return; }

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'AeneasSoft — Reset your password',
    html: `
      <h2>Reset your password</h2>
      <p>Click the link below to reset your password. This link is valid for 1 hour.</p>
      <p><a href="${resetUrl}" style="background:#F0A500;color:#0A1628;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a></p>
      <p style="color:#666;font-size:12px;">If you didn't request this, ignore this email.</p>
    `,
  });
}

// ── Payment Failed Email ─────────────────────────────────────────────────────

export async function sendPaymentFailedEmail(to: string): Promise<void> {
  const resend = getResend();
  if (!resend) { console.log(`[PRODUCTNAME] Email (no Resend): PaymentFailed → ${to}`); return; }

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'AeneasSoft — Payment failed',
    html: `
      <h2>Payment failed</h2>
      <p>Your payment for AeneasSoft could not be processed. Please update your payment method:</p>
      <p><a href="${DASHBOARD_URL}/billing" style="background:#F0A500;color:#0A1628;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Update Payment Method</a></p>
    `,
  });
}

// ── Subscription Cancelled Email ─────────────────────────────────────────────

export async function sendSubscriptionCancelledEmail(to: string): Promise<void> {
  const resend = getResend();
  if (!resend) { console.log(`[PRODUCTNAME] Email (no Resend): SubscriptionCancelled → ${to}`); return; }

  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Dein AeneasSoft Pro Abo wurde beendet',
    html: `
      <h2>Dein Abo wurde beendet</h2>
      <p>Dein AeneasSoft Pro Abo wurde beendet. Dein Account wurde auf den <strong>Free Plan</strong> zurückgesetzt.</p>
      <p>Du kannst jederzeit wieder upgraden und alle Pro-Features nutzen:</p>
      <p><a href="https://aeneassoft.com/pricing" style="background:#F0A500;color:#0A1628;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Wieder upgraden</a></p>
      <p style="color:#666;font-size:12px;">Fragen? Schreib uns an support@aeneassoft.com</p>
    `,
  });
}

// ── Alert Triggered Email ────────────────────────────────────────────────────

export async function sendAlertEmail(to: string, alertName: string, value: number, threshold: number): Promise<void> {
  const resend = getResend();
  if (!resend) { console.log(`[PRODUCTNAME] Email (no Resend): Alert → ${to}: ${alertName}`); return; }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `AeneasSoft Alert: ${alertName}`,
    html: `
      <h2>Alert: ${alertName}</h2>
      <p>Your alert <strong>"${alertName}"</strong> was triggered.</p>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:4px 12px;color:#666;">Value:</td><td style="padding:4px 12px;font-weight:bold;">${value.toFixed(4)}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">Threshold:</td><td style="padding:4px 12px;">${threshold}</td></tr>
        <tr><td style="padding:4px 12px;color:#666;">Time:</td><td style="padding:4px 12px;">${new Date().toISOString()}</td></tr>
      </table>
      <p><a href="${DASHBOARD_URL}/alerts" style="color:#00B4FF;">View in Dashboard</a></p>
    `,
  });
}

// ── Contact/Sales Email ──────────────────────────────────────────────────────

export async function sendContactEmail(name: string, email: string, company: string, message: string, type: string = 'contact'): Promise<void> {
  const resend = getResend();
  const subject = type === 'investor' ? `Investor Inquiry from ${name}` :
                  type === 'career' ? `Career Interest from ${name}` :
                  `Contact from ${name} (${company})`;

  const SALES_EMAIL = process.env.SALES_EMAIL || 'leonhard.hampe@aeneassoft.com';
  if (!resend) { console.log(`[PRODUCTNAME] Email (no Resend): ${subject} → ${SALES_EMAIL}`); return; }

  await resend.emails.send({
    from: FROM,
    to: SALES_EMAIL,
    replyTo: email,
    subject,
    html: `
      <h2>${subject}</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Company:</strong> ${company}</p>
      <p><strong>Type:</strong> ${type}</p>
      <hr/>
      <p>${message}</p>
    `,
  });
}
