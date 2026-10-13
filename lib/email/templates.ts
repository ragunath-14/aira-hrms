import { appUrl } from "@/lib/email/mailer";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// One simple, readable layout for every email (inline styles: email clients
// ignore stylesheets). Returns both the HTML and a plain-text version.
export function renderEmail(params: {
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
}) {
  const { heading, paragraphs, button, footnote } = params;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;">
            <tr><td style="font-size:13px;font-weight:700;color:#2563eb;letter-spacing:.04em;">AIRA HRMS</td></tr>
            <tr><td style="padding-top:12px;font-size:22px;font-weight:700;">${escapeHtml(heading)}</td></tr>
            ${paragraphs
              .map(
                (p) =>
                  `<tr><td style="padding-top:14px;font-size:15px;line-height:1.55;">${escapeHtml(p)}</td></tr>`,
              )
              .join("\n            ")}
            ${
              button
                ? `<tr><td style="padding-top:24px;"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">${escapeHtml(button.label)}</a></td></tr>
            <tr><td style="padding-top:14px;font-size:12px;color:#6b7280;word-break:break-all;">If the button does not work, copy this link: ${escapeHtml(button.url)}</td></tr>`
                : ""
            }
            ${
              footnote
                ? `<tr><td style="padding-top:24px;font-size:12px;color:#6b7280;">${escapeHtml(footnote)}</td></tr>`
                : ""
            }
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    heading,
    "",
    ...paragraphs,
    ...(button ? ["", `${button.label}: ${button.url}`] : []),
    ...(footnote ? ["", footnote] : []),
  ].join("\n");

  return { html, text };
}

export function passwordResetEmail(name: string, url: string) {
  return {
    subject: "Reset your AIRA HRMS password",
    ...renderEmail({
      heading: "Reset your password",
      paragraphs: [
        `Hi ${name || "there"}, we received a request to reset the password for your account.`,
        "This link works for one hour. If you did not ask for it, you can ignore this email: your password stays the same.",
      ],
      button: { label: "Choose a new password", url },
      footnote: "For your security, never share this link with anyone.",
    }),
  };
}

export function passwordChangedEmail(name: string) {
  return {
    subject: "Your AIRA HRMS password was changed",
    ...renderEmail({
      heading: "Your password was changed",
      paragraphs: [
        `Hi ${name || "there"}, the password for your account was just changed.`,
        "If this was you, no action is needed. If it was not, contact your administrator right away.",
      ],
      button: { label: "Open AIRA HRMS", url: appUrl() },
    }),
  };
}

export function notificationEmail(params: {
  name: string;
  title: string;
  message: string;
  link?: string | null;
}) {
  return {
    subject: params.title,
    ...renderEmail({
      heading: params.title,
      paragraphs: [`Hi ${params.name || "there"},`, params.message],
      button: params.link
        ? { label: "Open", url: params.link }
        : { label: "Open AIRA HRMS", url: appUrl() },
      footnote: "You receive this email because of your notification settings in AIRA HRMS.",
    }),
  };
}
