import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email over SMTP (any provider: Brevo, Resend, Gmail app password,
 * Zoho, SES ...). Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and
 * MAIL_FROM. Without them, sign-up skips email verification.
 */
export const isMailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

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
    });
    return transporter;
};

const escapeHtml = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The 6-digit code that confirms a new account's email. */
export const sendSignupCode = async ({ to, name, code }: { to: string; name: string; code: string }) => {
    await getTransporter().sendMail({
        from: process.env.MAIL_FROM,
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
