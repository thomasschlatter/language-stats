// Minimal transactional-email helper. Provider-agnostic over SMTP, so it works
// with Google Workspace (smtp.gmail.com), Resend, SendGrid, Mailgun, etc.
// Configure via env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
// If SMTP isn't configured, emails are logged to the console (dev fallback) so
// the flow still works locally.
import nodemailer from 'nodemailer';

let transporter;

export function mailConfigured() {
  return !!process.env.SMTP_HOST;
}

function getTransporter() {
  if (transporter !== undefined) return transporter;
  if (!process.env.SMTP_HOST) { transporter = null; return null; }
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

function fromAddress() {
  // Gmail/Workspace requires From to match the authenticated user (or a send-as
  // alias), so default to SMTP_USER when MAIL_FROM isn't set.
  return process.env.MAIL_FROM || process.env.SMTP_USER || 'no-reply@groupifier.com';
}

export async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[mail:dev] (SMTP not configured) To: ${to}\nSubject: ${subject}\n${text || ''}`);
    return { dev: true };
  }
  await t.sendMail({ from: fromAddress(), to, subject, html, text });
  return { dev: false };
}
