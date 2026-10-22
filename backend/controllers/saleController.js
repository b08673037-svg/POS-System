import mongoose from "mongoose";
import Sale from "../models/Sale.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import asyncHandler from "../middleware/asyncHandler.js";
import Notification from "../models/Notification.js";
import {
  queueSaleNotifications,
  sendSaleNotifications,
  retrySaleNotifications,
} from "../services/notificationService.js";

/* =========================================================
 *  HELPERS
 * ========================================================= */

/**
 * Round to 2 decimal places.
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Generate a unique invoice number INV-YYYYMMDD-NNNN.
 * The unique index on invoiceNumber is the real guarantee; this
 * just makes the sequence human-friendly.
 */
const generateInvoiceNumber = async () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `INV-${yyyy}${mm}${dd}`;

  const lastSale = await Sale.findOne({
    invoiceNumber: { $regex: `^${prefix}-` },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber");

  let seq = 1;
  if (lastSale) {
    const parts = lastSale.invoiceNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(4, "0")}`;
};

/**
 * Derive payment status from total vs amount paid.
 */
const derivePaymentStatus = (total, amountPaid) => {
  if (amountPaid <= 0) return "unpaid";
  if (amountPaid < total) return "partial";
  return "paid";
};

/* =========================================================
 *  CREATE SALE
 * ========================================================= */

/**
 * @desc    Create a sale, decrement stock atomically, queue notifications
 * @route   POST /api/sales
 * @access  Public
 *
 * Server-authoritative rules:
 *   - Ignores any subtotal, total, balance, item.subtotal,
 *     item.costPrice, and item.sellingPrice sent by the client.
 *   - Verifies sufficient stock BEFORE any decrement.
 *   - Decrements stock inside a transaction. If ANY item fails
 *     the stock guard, all decrements are rolled back.
 *   - Queues notification documents inside the same transaction.
 *   - Fires emails AFTER commit, non-blocking.
 */
export const createSale = asyncHandler(async (req, res) => {
  const {
    customer: customerId,
    items,
    discount = 0,
    tax = 0,
    amountPaid = 0,
    paymentMethod = "cash",
  } = req.body;

  // ---- 1. Validate items array ----
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("A sale must contain at least one item");
  }

  // ---- 2. Resolve customer (or walk-in) ----
  let customer = null;
  let customerName = "Walk-in Customer";
  let customerPhone = "";

  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer || !customer.isActive) {
      res.status(400);
      throw new Error("Referenced customer does not exist or is inactive");
    }
    customerName = customer.fullName;
    customerPhone = customer.phone || "";
  }

  // ---- 3. Validate and enrich each item (never trust client prices) ----
  const enrichedItems = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i] || {};
    const productId = raw.product;
    const qty = Number(raw.quantity);

    if (!productId) {
      res.status(400);
      throw new Error(`Item ${i + 1}: product is required`);
    }
    if (!Number.isInteger(qty) || qty < 1) {
      res.status(400);
      throw new Error(
        `Item ${i + 1}: quantity must be a positive whole number`
      );
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      res.status(400);
      throw new Error(`Item ${i + 1}: product does not exist or is inactive`);
    }

    if (product.stockQuantity < qty) {
      res.status(400);
      throw new Error(
        `Insufficient stock for "${product.name}" (${product.sku}). ` +
          `Requested ${qty}, available ${product.stockQuantity}.`
      );
    }

    const sellingPrice = round2(product.sellingPrice);
    const costPrice = round2(product.purchasePrice);
    const subtotal = round2(qty * sellingPrice);

    enrichedItems.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      quantity: qty,
      sellingPrice,
      costPrice,
      subtotal,
    });
  }

  // ---- 4. Server-authoritative money math ----
  const subtotal = round2(
    enrichedItems.reduce((sum, it) => sum + it.subtotal, 0)
  );

  const discountNum = Number(discount);
  const taxNum = Number(tax);
  const amountPaidNum = Number(amountPaid);

  if (!Number.isFinite(discountNum) || discountNum < 0) {
    res.status(400);
    throw new Error("Discount must be a non-negative number");
  }
  if (!Number.isFinite(taxNum) || taxNum < 0) {
    res.status(400);
    throw new Error("Tax must be a non-negative number");
  }
  if (!Number.isFinite(amountPaidNum) || amountPaidNum < 0) {
    res.status(400);
    throw new Error("Amount paid must be a non-negative number");
  }
  if (discountNum > subtotal) {
    res.status(400);
    throw new Error("Discount cannot exceed the sale subtotal");
  }

  const total = round2(subtotal - discountNum + taxNum);
  const balance = round2(Math.max(0, total - amountPaidNum));
  const paymentStatus = derivePaymentStatus(total, amountPaidNum);

  // ---- 5. Invoice number ----
  const invoiceNumber = await generateInvoiceNumber();

  // ---- 6. Transaction: sale + stock + notification queue ----
  const session = await mongoose.startSession();
  let sale;
  let notificationDocs = { admin: null, customer: null };

  try {
    session.startTransaction();

    for (const item of enrichedItems) {
      const result = await Product.updateOne(
        {
          _id: item.product,
          stockQuantity: { $gte: item.quantity },
        },
        { $inc: { stockQuantity: -item.quantity } },
        { session }
      );

      if (result.matchedCount !== 1) {
        throw new Error(
          `Insufficient stock for "${item.name}" (${item.sku}). ` +
            `Requested ${item.quantity}. Another sale may have just taken it — please refresh and try again.`
        );
      }
    }

    const created = await Sale.create(
      [
        {
          invoiceNumber,
          customer: customer ? customer._id : null,
          customerName,
          customerPhone,
          items: enrichedItems,
          subtotal,
          discount: discountNum,
          tax: taxNum,
          total,
          amountPaid: amountPaidNum,
          balance,
          paymentMethod,
          paymentStatus,
          status: "completed",
          stockApplied: true,
          stockRestored: false,
        },
      ],
      { session }
    );
    sale = created[0];

    // Queue notifications inside the same transaction. If the
    // transaction aborts, these documents vanish — no orphan
    // notifications for a sale that never committed.
    notificationDocs = await queueSaleNotifications(sale, session);

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  // ---- 7. Fire emails AFTER commit, non-blocking ----
  if (notificationDocs.admin || notificationDocs.customer) {
    sendSaleNotifications(sale._id).catch((err) => {
      console.error("[notifications] unexpected failure:", err.message);
    });
  }

  // ---- 8. Respond with sale + notification status ----
  const populated = await Sale.findById(sale._id).populate(
    "customer",
    "fullName phone email"
  );

  const notifications = {
    admin: notificationDocs.admin
      ? { status: "queued", to: notificationDocs.admin.to }
      : {
          status: "skipped",
          reason: "Admin email not configured or email service disabled",
        },
    customer: notificationDocs.customer
      ? { status: "queued", to: notificationDocs.customer.to }
      : {
          status: "skipped",
          reason: "Walk-in sale or customer has no email address",
        },
  };

  res.status(201).json({
    success: true,
    message: "Sale recorded successfully",
    data: populated,
    notifications,
  });
});

/* =========================================================
 *  LIST SALES
 * ========================================================= */

/**
 * @desc    List sales with filters + pagination
 * @route   GET /api/sales
 * @access  Public
 */
export const getSales = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const { search, customer, paymentMethod, paymentStatus, status, from, to } =
    req.query;

  const filter = {};

  if (customer) filter.customer = customer;
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (status) filter.status = status;

  if (search && search.trim()) {
    filter.invoiceNumber = { $regex: search.trim(), $options: "i" };
  }

  if (from || to) {
    filter.createdAt = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) filter.createdAt.$gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = d;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .populate("customer", "fullName phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Sale.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: sales.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: sales,
  });
});

/* =========================================================
 *  GET SINGLE SALE
 * ========================================================= */

export const getSaleById = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate(
    "customer",
    "fullName phone email"
  );

  if (!sale) {
    res.status(404);
    throw new Error("Sale not found");
  }

  res.status(200).json({ success: true, data: sale });
});

/* =========================================================
 *  DAILY SUMMARY
 * ========================================================= */

export const getDailySalesSummary = asyncHandler(async (req, res) => {
  let dayStart, dayEnd;
  if (req.query.date) {
    const parsed = new Date(req.query.date);
    if (Number.isNaN(parsed.getTime())) {
      res.status(400);
      throw new Error("Invalid date format. Use YYYY-MM-DD.");
    }
    dayStart = new Date(parsed);
    dayStart.setHours(0, 0, 0, 0);
    dayEnd = new Date(parsed);
    dayEnd.setHours(23, 59, 59, 999);
  } else {
    dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
  }

  const matchStage = {
    status: "completed",
    createdAt: { $gte: dayStart, $lte: dayEnd },
  };

  const [result] = await Sale.aggregate([
    { $match: matchStage },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              transactionCount: { $sum: 1 },
              totalRevenue: { $sum: "$total" },
              totalCollected: { $sum: "$amountPaid" },
              totalOutstanding: { $sum: "$balance" },
              totalDiscount: { $sum: "$discount" },
              totalTax: { $sum: "$tax" },
            },
          },
        ],
        cogs: [
          { $unwind: "$items" },
          {
            $group: {
              _id: null,
              totalCOGS: {
                $sum: { $multiply: ["$items.costPrice", "$items.quantity"] },
              },
            },
          },
        ],
      },
    },
  ]);

  const totals = result?.totals?.[0] || {
    transactionCount: 0,
    totalRevenue: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    totalDiscount: 0,
    totalTax: 0,
  };
  const totalCOGS = result?.cogs?.[0]?.totalCOGS || 0;

  const grossProfit = round2(totals.totalRevenue - totalCOGS);

  res.status(200).json({
    success: true,
    data: {
      date: dayStart.toISOString().slice(0, 10),
      transactionCount: totals.transactionCount,
      totalRevenue: round2(totals.totalRevenue),
      totalCollected: round2(totals.totalCollected),
      totalOutstanding: round2(totals.totalOutstanding),
      totalDiscount: round2(totals.totalDiscount),
      totalTax: round2(totals.totalTax),
      totalCOGS: round2(totalCOGS),
      grossProfit,
    },
  });
});

/* =========================================================
 *  EDIT SALE
 * ========================================================= */

/**
 * @desc    Update an existing sale
 * @route   PUT /api/sales/:id
 *
 * NOTE: No email is sent on edit. Original purchase confirmation
 * is a once-per-sale event. This matches requirement 11 of the spec.
 */
export const updateSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) {
    res.status(404);
    throw new Error("Sale not found");
  }
  if (sale.status === "cancelled") {
    res.status(400);
    throw new Error("Cannot edit a cancelled sale");
  }

  const {
    customer: customerId,
    items,
    discount = 0,
    tax = 0,
    amountPaid = 0,
    paymentMethod = sale.paymentMethod,
  } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("A sale must contain at least one item");
  }

  let customer = null;
  let customerName = "Walk-in Customer";
  let customerPhone = "";

  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer || !customer.isActive) {
      res.status(400);
      throw new Error("Referenced customer does not exist or is inactive");
    }
    customerName = customer.fullName;
    customerPhone = customer.phone || "";
  }

  const enrichedItems = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i] || {};
    const productId = raw.product;
    const qty = Number(raw.quantity);

    if (!productId) {
      res.status(400);
      throw new Error(`Item ${i + 1}: product is required`);
    }
    if (!Number.isInteger(qty) || qty < 1) {
      res.status(400);
      throw new Error(
        `Item ${i + 1}: quantity must be a positive whole number`
      );
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      res.status(400);
      throw new Error(`Item ${i + 1}: product does not exist or is inactive`);
    }

    const sellingPrice = round2(product.sellingPrice);
    const costPrice = round2(product.purchasePrice);
    const subtotal = round2(qty * sellingPrice);

    enrichedItems.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      quantity: qty,
      sellingPrice,
      costPrice,
      subtotal,
    });
  }

  const subtotal = round2(
    enrichedItems.reduce((sum, it) => sum + it.subtotal, 0)
  );

  const discountNum = Number(discount);
  const taxNum = Number(tax);
  const amountPaidNum = Number(amountPaid);

  if (!Number.isFinite(discountNum) || discountNum < 0) {
    res.status(400);
    throw new Error("Discount must be a non-negative number");
  }
  if (!Number.isFinite(taxNum) || taxNum < 0) {
    res.status(400);
    throw new Error("Tax must be a non-negative number");
  }
  if (!Number.isFinite(amountPaidNum) || amountPaidNum < 0) {
    res.status(400);
    throw new Error("Amount paid must be a non-negative number");
  }
  if (discountNum > subtotal) {
    res.status(400);
    throw new Error("Discount cannot exceed the sale subtotal");
  }

  const total = round2(subtotal - discountNum + taxNum);
  const balance = round2(Math.max(0, total - amountPaidNum));
  const paymentStatus = derivePaymentStatus(total, amountPaidNum);

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    for (const oldItem of sale.items) {
      const result = await Product.updateOne(
        { _id: oldItem.product },
        { $inc: { stockQuantity: oldItem.quantity } },
        { session }
      );
      if (result.matchedCount !== 1) {
        throw new Error(
          `Cannot edit: product "${oldItem.name}" (${oldItem.sku}) no longer exists`
        );
      }
    }

    for (const newItem of enrichedItems) {
      const result = await Product.updateOne(
        {
          _id: newItem.product,
          stockQuantity: { $gte: newItem.quantity },
        },
        { $inc: { stockQuantity: -newItem.quantity } },
        { session }
      );
      if (result.matchedCount !== 1) {
        throw new Error(
          `Cannot edit: not enough stock for "${newItem.name}" (${newItem.sku}). ` +
            `Requested ${newItem.quantity}. Refresh and try again.`
        );
      }
    }

    sale.customer = customer ? customer._id : null;
    sale.customerName = customerName;
    sale.customerPhone = customerPhone;
    sale.items = enrichedItems;
    sale.subtotal = subtotal;
    sale.discount = discountNum;
    sale.tax = taxNum;
    sale.total = total;
    sale.amountPaid = amountPaidNum;
    sale.balance = balance;
    sale.paymentMethod = paymentMethod;
    sale.paymentStatus = paymentStatus;
    await sale.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const updated = await Sale.findById(sale._id).populate(
    "customer",
    "fullName phone"
  );

  res.status(200).json({
    success: true,
    message: "Sale updated successfully",
    data: updated,
  });
});

/* =========================================================
 *  CANCEL SALE
 * ========================================================= */

/**
 * @desc    Cancel a sale (restore stock, preserve document for audit)
 * @route   PATCH /api/sales/:id/cancel
 *
 * NOTE: No email is sent on cancel. This matches requirement 11.
 */
export const cancelSale = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) {
    res.status(404);
    throw new Error("Sale not found");
  }
  if (sale.status === "cancelled") {
    res.status(400);
    throw new Error("This sale has already been cancelled");
  }

  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (sale.stockApplied) {
      for (const item of sale.items) {
        const result = await Product.updateOne(
          { _id: item.product },
          { $inc: { stockQuantity: item.quantity } },
          { session }
        );
        if (result.matchedCount !== 1) {
          throw new Error(
            `Cannot cancel: product "${item.name}" (${item.sku}) no longer exists`
          );
        }
      }
    }

    sale.status = "cancelled";
    sale.stockApplied = false;
    sale.stockRestored = true;
    sale.cancelledAt = new Date();
    sale.cancelReason = reason;
    await sale.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const updated = await Sale.findById(sale._id).populate(
    "customer",
    "fullName phone"
  );

  res.status(200).json({
    success: true,
    message: "Sale cancelled. Stock has been restored.",
    data: updated,
  });
});

/* =========================================================
 *  NOTIFICATION STATUS + RETRY
 * ========================================================= */

/**
 * @desc    Get the notification status for a sale
 * @route   GET /api/sales/:id/notifications
 * @access  Public
 *
 * Returns the Notification documents for this sale — one per kind
 * (admin, customer). Used by the UI to show delivery status.
 */
export const getSaleNotifications = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).select("_id");
  if (!sale) {
    res.status(404);
    throw new Error("Sale not found");
  }
  const notifications = await Notification.find({ sale: sale._id });
  res.status(200).json({ success: true, data: notifications });
});

/**
 * @desc    Retry failed notifications for a sale
 * @route   POST /api/sales/:id/retry-notifications
 * @access  Public
 *
 * Only failed notifications are retried. Notifications already
 * marked "sent" are skipped — so retrying never duplicates a
 * successful delivery.
 */
export const retrySaleNotification = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id).select("_id");
  if (!sale) {
    res.status(404);
    throw new Error("Sale not found");
  }

  const result = await retrySaleNotifications(sale._id);
  const notifications = await Notification.find({ sale: sale._id });

  res.status(200).json({
    success: true,
    message: result.message,
    data: notifications,
  });
});