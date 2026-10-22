import asyncHandler from "../middleware/asyncHandler.js";
import Product from "../models/Product.js";
import Purchase from "../models/Purchase.js";

/**
 * @desc    Get system notifications (low stock, pending purchases)
 * @route   GET /api/notifications
 * @access  Protected
 */
export const getNotifications = asyncHandler(async (req, res) => {
  // 1. Get products that are low on stock (removed .limit)
  const lowStock = await Product.find({
    isActive: true,
    $expr: { $lte: ["$stockQuantity", "$minStockLevel"] },
  })
    .select("name sku stockQuantity minStockLevel")
    .sort({ stockQuantity: 1 });

  // 2. Get pending purchases (removed .limit)
  const pendingPurchases = await Purchase.find({ status: "pending" })
    .select("purchaseNumber supplierName total createdAt")
    .sort({ createdAt: -1 });

  // 3. Format them into a single array
  const notifications = [
    ...lowStock.map((p) => ({
      id: p._id,
      type: "warning",
      title: "Low Stock Alert",
      message: `${p.name} (${p.sku}) is running low. Only ${p.stockQuantity} left.`,
      link: "/inventory",
    })),
    ...pendingPurchases.map((p) => ({
      id: p._id,
      type: "info",
      title: "Pending Purchase",
      message: `Purchase ${p.purchaseNumber} from ${p.supplierName} is not received yet.`,
      link: "/purchases",
    })),
  ];

  res.status(200).json({
    success: true,
    count: notifications.length,
    data: notifications,
  });
});