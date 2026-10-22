import Notification from "../models/Notification.js";
import Sale from "../models/Sale.js";
import Customer from "../models/Customer.js";
import { sendEmail, storeInfo, isEmailEnabled } from "./emailService.js";
import { buildAdminSaleEmail } from "../templates/adminSaleEmail.js";
import { buildCustomerSaleEmail } from "../templates/customerSaleEmail.js";

/**
 * Create the two Notification records (queued) for a completed sale.
 * Called INSIDE the sale transaction, so if the sale rolls back the
 * notifications roll back too.
 *
 * @param {object} sale       The Sale document (must have _id).
 * @param {object} [session]  Optional Mongoose session for transactional writes.
 * @returns {Promise<{admin: object|null, customer: object|null}>}
 */
export async function queueSaleNotifications(sale, session) {
  const docs = [];

  // ---------- Admin notification ----------
  // Recipient comes from the backend .env — never from the request body.
  const adminTo = process.env.ADMIN_EMAIL;
  if (adminTo && isEmailEnabled()) {
    docs.push({
      sale: sale._id,
      kind: "admin",
      to: adminTo,
      subject: `New Sale — Invoice ${sale.invoiceNumber}`,
    });
  }

  // ---------- Customer notification ----------
  // Only when the sale is linked to a customer that has a valid email.
  if (sale.customer) {
    const c = await Customer.findById(sale.customer).select("email");
    if (c?.email && /^\S+@\S+\.\S+$/.test(c.email)) {
      docs.push({
        sale: sale._id,
        kind: "customer",
        to: c.email,
        subject: `Your purchase at ${storeInfo.name} — Invoice ${sale.invoiceNumber}`,
      });
    }
  }

  if (docs.length === 0) {
    return { admin: null, customer: null };
  }

  // If only ONE document, we can use the simple form.
  // If MULTIPLE documents and a session is passed, Mongoose requires
  // `ordered: true` — otherwise the inserts could partially succeed
  // in parallel, breaking transactional guarantees.
  const options = session ? { session, ordered: true } : {};
  const created = await Notification.create(docs, options);

  const admin = created.find((d) => d.kind === "admin") || null;
  const customer = created.find((d) => d.kind === "customer") || null;
  return { admin, customer };
}

/**
 * Fire the actual emails for a sale. Non-blocking from the caller's
 * perspective — returns immediately, updates Notification documents
 * as the sends complete. Never throws.
 *
 * Idempotency: if a notification is already "sent", the send is
 * skipped unless `{ force: true }` is passed (used by the retry route).
 */
export async function sendSaleNotifications(saleId, { force = false } = {}) {
  let sale;
  try {
    sale = await Sale.findById(saleId);
    if (!sale) return;
  } catch (err) {
    console.error("[notifications] failed to load sale:", err.message);
    return;
  }

  const notifications = await Notification.find({ sale: sale._id });

  // Fire admin and customer notifications in parallel — they do not
  // depend on each other.
  await Promise.all(
    notifications.map((n) => dispatchNotification(n, sale, force))
  );
}

/**
 * Send one notification document. Updates its status/attempts/sentAt
 * fields, but never throws.
 */
async function dispatchNotification(notification, sale, force) {
  // Already delivered — do not resend unless explicitly forced.
  if (notification.status === "sent" && !force) return;

  if (!isEmailEnabled()) {
    notification.status = "failed";
    notification.error = "Email service is not configured";
    notification.lastAttemptAt = new Date();
    await notification.save();
    return;
  }

  notification.attempts += 1;
  notification.lastAttemptAt = new Date();

  // Build the correct template based on the notification kind.
  const { subject, html, text } =
    notification.kind === "admin"
      ? buildAdminSaleEmail(sale, storeInfo)
      : buildCustomerSaleEmail(sale, storeInfo);

  const result = await sendEmail({
    to: notification.to,
    subject,
    html,
    text,
  });

  if (result.ok) {
    notification.status = "sent";
    notification.messageId = result.messageId;
    notification.sentAt = new Date();
    notification.error = "";
    console.log(
      `[notifications] ${notification.kind} email sent for ${sale.invoiceNumber}`
    );
  } else {
    notification.status = "failed";
    notification.error = result.error;
    console.error(
      `[notifications] ${notification.kind} email FAILED for ${sale.invoiceNumber}: ${result.error}`
    );
  }

  await notification.save();
}

/**
 * Retry all failed notifications for a sale.
 * Called by the admin-triggered retry endpoint.
 */
export async function retrySaleNotifications(saleId) {
  const failed = await Notification.find({
    sale: saleId,
    status: "failed",
  });
  if (failed.length === 0) {
    return { retried: 0, message: "No failed notifications to retry" };
  }
  await sendSaleNotifications(saleId, { force: true });
  return {
    retried: failed.length,
    message: `Retried ${failed.length} notification(s)`,
  };
}