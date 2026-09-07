const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

/**
 * Send an email. Fails silently into the console in development if SMTP
 * credentials are not configured, so the rest of the app keeps working.
 */
async function sendEmail(to, subject, text) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[mailer] SMTP not configured — skipped email to ${to}: ${subject}`);
    return { skipped: true };
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
    return { messageId: info.messageId };
  } catch (err) {
    console.error("[mailer] send failed:", err.message);
    throw err;
  }
}

module.exports = { sendEmail };
