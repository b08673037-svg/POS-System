import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },

    // "admin" or "customer"
    kind: {
      type: String,
      enum: ["admin", "customer"],
      required: true,
    },

    // Where the email was sent
    to: { type: String, required: true },

    subject: { type: String, required: true },

    // "queued"  → created, email not yet attempted
    // "sent"    → SMTP accepted the message
    // "failed"  → SMTP rejected or network error
    // "skipped" → nothing to send (no customer email on walk-in)
    status: {
      type: String,
      enum: ["queued", "sent", "failed", "skipped"],
      default: "queued",
      index: true,
    },

    attempts: { type: Number, default: 0 },

    messageId: { type: String, default: null },

    error: { type: String, default: "" },

    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ sale: 1, kind: 1 }, { unique: true });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;