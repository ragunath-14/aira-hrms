import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// Email goes out over SMTP, so any provider works (Brevo, Resend, Mailgun,
// Amazon SES, Zoho Mail, Gmail with an app password ...). Set:
//   SMTP_HOST, SMTP_PORT (587 or 465), SMTP_USER, SMTP_PASS, SMTP_FROM
// Without SMTP_HOST and SMTP_FROM nothing is sent: the message is written to
// the server log instead (including links, to help local development) and
// the app carries on normally.

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

// The public address of the app, for links in emails.
export function appUrl() {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;

    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 uses implicit TLS; 587 upgrades with STARTTLS.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  return transporter;
}

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

// Sends one email. Never throws: a failed or skipped email must not break the
// action that triggered it. Returns true only when the provider accepted it.
export async function sendEmail(email: Email): Promise<boolean> {
  if (!emailConfigured()) {
    const preview =
      process.env.NODE_ENV === "production" ? "" : `\n${email.text}\n`;
    console.info(`[email:not-configured] to=${email.to} subject="${email.subject}"${preview}`);
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    return true;
  } catch (error) {
    console.error(
      `[email:failed] to=${email.to} subject="${email.subject}":`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}
