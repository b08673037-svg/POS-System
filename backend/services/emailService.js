import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/* ---------------------------------------------------------------
 *  Config validation
 *  Fail loudly at startup if anything required is missing —
 *  silent failures in email are impossible to debug later.
 * --------------------------------------------------------------- */
const REQUIRED = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.warn(
    `⚠️  Email service disabled — missing env vars: ${missing.join(", ")}`
  );
}

const EMAIL_ENABLED = missing.length === 0;

/* ---------------------------------------------------------------
 *  Transporter
 *  Created once and reused. Nodemailer pools connections under the
 *  hood, so every send does not open a fresh SMTP session.
 * --------------------------------------------------------------- */
let transporter = null;
if (EMAIL_ENABLED) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: String(process.env.EMAIL_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Do not spam the console with SMTP chatter unless debugging
    logger: false,
    debug: false,
  });
}

/**
 * Verify the SMTP credentials at startup.
 * Called from server.js so misconfigurations surface immediately,
 * not on the first sale.
 */
export const verifyEmailConfiguration = async () => {
  if (!EMAIL_ENABLED) {
    console.warn("⚠️  Skipping SMTP verification — email is disabled");
    return false;
  }
  try {
    await transporter.verify();
    console.log(`✅ Email service ready — sending as ${process.env.EMAIL_USER}`);
    return true;
  } catch (err) {
    console.error("❌ Email service verification failed:", err.message);
    console.error(
      "   Common causes: wrong App Password, 2FA not enabled, or network blocks port 587."
    );
    return false;
  }
};

/**
 * Send one email. Returns a result object, never throws.
 *
 *   { ok: true,  messageId: "..." }
 *   { ok: false, error: "..." }
 *
 * Callers decide what to do with the outcome — this function
 * never throws so a failed notification cannot crash a request.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  if (!EMAIL_ENABLED) {
    return { ok: false, error: "Email service is not configured" };
  }
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
    return { ok: false, error: `Invalid recipient address: ${to}` };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.STORE_NAME || "POS System"}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

export const isEmailEnabled = () => EMAIL_ENABLED;

/* ---------------------------------------------------------------
 *  Store info — read once, exported for use by templates
 * --------------------------------------------------------------- */
export const storeInfo = {
  name: process.env.STORE_NAME || "POS System",
  phone: process.env.STORE_PHONE || "",
  address: process.env.STORE_ADDRESS || "",
  email: process.env.STORE_EMAIL || process.env.EMAIL_USER || "",
};