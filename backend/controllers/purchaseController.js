import mongoose from "mongoose";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import Supplier from "../models/Supplier.js";
import asyncHandler from "../middleware/asyncHandler.js";

/**
 * Round a monetary value to 2 decimal places.
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Generate a unique purchase number PUR-YYYYMMDD-NNNN.
 * The unique index on purchaseNumber is the real guarantee.
 */
const generatePurchaseNumber = async () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `PUR-${yyyy}${mm}${dd}`;

  const lastPurchase = await Purchase.findOne({
    purchaseNumber: { $regex: `^${prefix}-` },
  })
    .sort({ purchaseNumber: -1 })
    .select("purchaseNumber");

  let seq = 1;
  if (lastPurchase) {
    const parts = lastPurchase.purchaseNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(4, "0")}`;
};

/**
 * Validate items + money fields from a request body and produce
 * server-authoritative values. Throws 400-style errors via res.status.
 *
 * Used by BOTH createPurchase and updatePurchase so the money math
 * lives in exactly one place.
 */
const validateAndCalculate = async (body, res) => {
  const {
    items,
    discount = 0,
    tax = 0,
    amountPaid = 0,
    paymentMethod = "cash",
  } = body;

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error("A purchase must contain at least one item");
  }

  const enrichedItems = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i] || {};
    const productId = raw.product;
    const qty = Number(raw.quantity);
    const price = Number(raw.purchasePrice);

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
    if (!Number.isFinite(price) || price < 0) {
      res.status(400);
      throw new Error(
        `Item ${i + 1}: purchase price must be a non-negative number`
      );
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      res.status(400);
      throw new Error(`Item ${i + 1}: product does not exist or is inactive`);
    }

    enrichedItems.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      quantity: qty,
      purchasePrice: price,
      subtotal: round2(qty * price),
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
    throw new Error("Discount cannot exceed the purchase subtotal");
  }

  const total = round2(subtotal - discountNum + taxNum);
  const balance = round2(Math.max(0, total - amountPaidNum));

  return {
    enrichedItems,
    subtotal,
    discount: discountNum,
    tax: taxNum,
    total,
    amountPaid: amountPaidNum,
    balance,
    paymentMethod,
  };
};

/**
 * @desc    Create a purchase (always starts in `pending` — no stock effect)
 * @route   POST /api/purchases
 * @access  Public
 */
export const createPurchase = asyncHandler(async (req, res) => {
  const { supplier: supplierId } = req.body;

  if (!supplierId) {
    res.status(400);
    throw new Error("Supplier is required");
  }
  const supplier = await Supplier.findById(supplierId);
  if (!supplier || !supplier.isActive) {
    res.status(400);
    throw new Error("Referenced supplier does not exist or is inactive");
  }

  const calc = await validateAndCalculate(req.body, res);
  const purchaseNumber = await generatePurchaseNumber();

  const purchase = await Purchase.create({
    purchaseNumber,
    supplier: supplier._id,
    supplierName: supplier.name,
    items: calc.enrichedItems,
    subtotal: calc.subtotal,
    discount: calc.discount,
    tax: calc.tax,
    total: calc.total,
    amountPaid: calc.amountPaid,
    balance: calc.balance,
    paymentMethod: calc.paymentMethod,
    status: "pending",
    stockApplied: false,
  });

  res.status(201).json({
    success: true,
    message:
      "Purchase created in pending state. No inventory change until it is received.",
    data: purchase,
  });
});

/**
 * @desc    List purchases with filters + pagination
 * @route   GET /api/purchases
 * @access  Public
 */
export const getPurchases = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const { search, supplier, status, from, to } = req.query;
  const filter = {};

  if (supplier) filter.supplier = supplier;
  if (status) filter.status = status;

  if (search && search.trim()) {
    filter.purchaseNumber = { $regex: search.trim(), $options: "i" };
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

  const [purchases, total] = await Promise.all([
    Purchase.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Purchase.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: purchases.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: purchases,
  });
});

/**
 * @desc    Get a single purchase
 * @route   GET /api/purchases/:id
 * @access  Public
 */
export const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) {
    res.status(404);
    throw new Error("Purchase not found");
  }
  res.status(200).json({ success: true, data: purchase });
});

/**
 * @desc    Receive a purchase: pending → received, stock increases atomically
 * @route   PATCH /api/purchases/:id/receive
 * @access  Public
 *
 * Idempotency:
 *   - If already received → 400
 *   - If cancelled        → 400
 *   Only a pending purchase can be received, and only once.
 *
 * Atomicity:
 *   All product stock increments AND the purchase status flip happen
 *   inside one transaction. If any increment fails, the whole thing
 *   rolls back — no partial stock update.
 */
export const receivePurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) {
    res.status(404);
    throw new Error("Purchase not found");
  }
  if (purchase.status === "cancelled") {
    res.status(400);
    throw new Error("Cannot receive a cancelled purchase");
  }
  if (purchase.status === "received" || purchase.stockApplied) {
    res.status(400);
    throw new Error("This purchase has already been received");
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    for (const item of purchase.items) {
      const result = await Product.updateOne(
        { _id: item.product },
        { $inc: { stockQuantity: item.quantity } },
        { session }
      );
      if (result.matchedCount !== 1) {
        throw new Error(
          `Product ${item.name} (${item.sku}) no longer exists`
        );
      }
    }

    purchase.status = "received";
    purchase.stockApplied = true;
    await purchase.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const updated = await Purchase.findById(purchase._id);
  res.status(200).json({
    success: true,
    message: "Purchase received. Stock has been increased.",
    data: updated,
  });
});

/**
 * @desc    Update a purchase
 * @route   PUT /api/purchases/:id
 * @access  Public
 *
 * Rules:
 *   - Cannot edit a cancelled purchase.
 *   - If the purchase was already received, its OLD items are reversed
 *     from stock, then the NEW items are applied. Both steps run inside
 *     one transaction.
 *   - Reversal uses a `stockQuantity >= item.quantity` guard so we never
 *     drive stock negative. If any item fails the guard, the whole
 *     operation is rejected and the original purchase + stock stay intact.
 *   - If the purchase was pending (no stock effect yet), only the
 *     document is updated — no stock change.
 *
 * NOTE: The reversal is done conservatively — full old quantity removed,
 * then full new quantity applied. For a single edit this yields the same
 * net result as a per-product diff, but is stricter when stock is tight.
 */
export const updatePurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) {
    res.status(404);
    throw new Error("Purchase not found");
  }
  if (purchase.status === "cancelled") {
    res.status(400);
    throw new Error("Cannot edit a cancelled purchase");
  }

  const calc = await validateAndCalculate(req.body, res);
  const wasReceived = purchase.stockApplied === true;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (wasReceived) {
      // 1. Reverse the old items from stock
      for (const oldItem of purchase.items) {
        const result = await Product.updateOne(
          {
            _id: oldItem.product,
            stockQuantity: { $gte: oldItem.quantity },
          },
          { $inc: { stockQuantity: -oldItem.quantity } },
          { session }
        );
        if (result.matchedCount !== 1) {
          throw new Error(
            `Cannot edit: reversing this purchase would push stock negative for "${oldItem.name}" (${oldItem.sku}). Some of these items may have already been sold.`
          );
        }
      }
    }

    // 2. Update the purchase document fields
    purchase.items = calc.enrichedItems;
    purchase.subtotal = calc.subtotal;
    purchase.discount = calc.discount;
    purchase.tax = calc.tax;
    purchase.total = calc.total;
    purchase.amountPaid = calc.amountPaid;
    purchase.balance = calc.balance;
    purchase.paymentMethod = calc.paymentMethod;
    await purchase.save({ session });

    if (wasReceived) {
      // 3. Apply the new items to stock
      for (const newItem of calc.enrichedItems) {
        const result = await Product.updateOne(
          { _id: newItem.product },
          { $inc: { stockQuantity: newItem.quantity } },
          { session }
        );
        if (result.matchedCount !== 1) {
          throw new Error(
            `Product ${newItem.name} (${newItem.sku}) no longer exists`
          );
        }
      }
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const updated = await Purchase.findById(purchase._id);
  res.status(200).json({
    success: true,
    message: "Purchase updated successfully",
    data: updated,
  });
});

/**
 * @desc    Cancel a purchase
 * @route   PATCH /api/purchases/:id/cancel
 * @access  Public
 *
 * Idempotency:
 *   - If already cancelled → 400 (prevents double-cancellation)
 *
 * Stock:
 *   - If the purchase was received, its items are reversed from stock.
 *   - The reversal is guarded with `stockQuantity >= item.quantity`, so
 *     we never drive stock negative. If the guard fails, the transaction
 *     is aborted and the purchase remains in its original state.
 *   - If the purchase was pending, no stock change happens.
 *
 * Audit:
 *   cancelledAt and cancelReason are recorded. The purchase document is
 *   preserved — never hard-deleted — so purchase history remains intact.
 */
export const cancelPurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) {
    res.status(404);
    throw new Error("Purchase not found");
  }
  if (purchase.status === "cancelled") {
    res.status(400);
    throw new Error("This purchase has already been cancelled");
  }

  const reason =
    typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const wasReceived = purchase.stockApplied === true;

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    if (wasReceived) {
      for (const item of purchase.items) {
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
            `Cannot cancel: reversing this purchase would push stock negative for "${item.name}" (${item.sku}). Some of these items may have already been sold.`
          );
        }
      }
    }

    purchase.status = "cancelled";
    purchase.stockApplied = false; // stock no longer reflects this purchase
    purchase.cancelledAt = new Date();
    purchase.cancelReason = reason;
    await purchase.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  const updated = await Purchase.findById(purchase._id);
  res.status(200).json({
    success: true,
    message: wasReceived
      ? "Purchase cancelled. Stock has been restored."
      : "Purchase cancelled.",
    data: updated,
  });
});