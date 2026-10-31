import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email. Set MAIL_FROM (e.g. "Aivex <no-reply@aivex.in>") and one of:
 * - BREVO_API_KEY or RESEND_API_KEY: sends over HTTPS. Use this on hosts that
 *   block SMTP ports (Render's free plan blocks 25, 465 and 587).
 * - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS: any SMTP provider.
 * Without them, sign-up skips email verification.
 */
export const isMailConfigured = () =>
    Boolean(process.env.MAIL_FROM && (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY || process.env.SMTP_HOST));

/** Give up quickly instead of leaving the sign-up form spinning. */
const TIMEOUT_MS = 15_000;

interface Mail {
    to: string;
    subject: string;
    text: string;
    html: string;
}

/** "Aivex <no-reply@aivex.in>" -> { name: "Aivex", email: "no-reply@aivex.in" } */
const parseFrom = (from: string) => {
    const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    return match ? { name: match[1] || undefined, email: match[2].trim() } : { email: from.trim() };
};

const postJson = async (url: string, headers: Record<string, string>, body: unknown) => {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
};

let transporter: Transporter | null = null;

const getTransporter = () => {
    if (transporter) return transporter;
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465, // 587 upgrades with STARTTLS
        requireTLS: port !== 465 && port !== 25,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        connectionTimeout: TIMEOUT_MS,
        greetingTimeout: TIMEOUT_MS,
        socketTimeout: TIMEOUT_MS,
    });
    return transporter;
};

const send = async (mail: Mail) => {
    const from = process.env.MAIL_FROM!;
    if (process.env.BREVO_API_KEY) {
        return postJson("https://api.brevo.com/v3/smtp/email", { "api-key": process.env.BREVO_API_KEY }, {
            sender: parseFrom(from),
            to: [{ email: mail.to }],
            subject: mail.subject,
            textContent: mail.text,
            htmlContent: mail.html,
        });
    }
    if (process.env.RESEND_API_KEY) {
        return postJson("https://api.resend.com/emails", { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, {
            from,
            to: [mail.to],
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
        });
    }
    await getTransporter().sendMail({ from, ...mail });
};

const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The 6-digit code that confirms a new account's email. */
export const sendSignupCode = async ({ to, name, code }: { to: string; name: string; code: string }) => {
    await send({
        to,
        subject: `${code} is your Aivex verification code`,
        text: `Hi ${name},\n\nYour Aivex verification code is ${code}. It expires in 10 minutes.\n\nIf you didn't try to create an Aivex account, ignore this email.\n`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#18181b">
  <h2 style="margin:0 0 12px">Verify your email</h2>
  <p>Hi ${escapeHtml(name)}, use this code to finish creating your Aivex account:</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:24px 0;color:#0d9488">${code}</p>
  <p style="color:#52525b;font-size:14px">It expires in 10 minutes. If you didn't try to create an Aivex account, ignore this email.</p>
</div>`,
    });
};
