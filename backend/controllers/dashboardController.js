import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import Supplier from "../models/Supplier.js";
import asyncHandler from "../middleware/asyncHandler.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Calculate exactly from 00:00:00 to 23:59:59 of the current server day
const todayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const thisMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

const salesTotalsInRange = async (start, end) => {
  const [result] = await Sale.aggregate([
    { $match: { status: "completed", createdAt: { $gte: start, $lte: end } } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              revenue: { $sum: "$total" },
              collected: { $sum: "$amountPaid" },
              outstanding: { $sum: "$balance" },
              transactionCount: { $sum: 1 },
            },
          },
        ],
        cogs: [
          { $unwind: "$items" },
          { $group: { _id: null, cogs: { $sum: { $multiply: ["$items.costPrice", "$items.quantity"] } } } },
        ],
      },
    },
  ]);

  const totals = result?.totals?.[0] || { revenue: 0, collected: 0, outstanding: 0, transactionCount: 0 };
  const cogs = result?.cogs?.[0]?.cogs || 0;

  return {
    revenue: round2(totals.revenue),
    collected: round2(totals.collected),
    outstanding: round2(totals.outstanding),
    transactionCount: totals.transactionCount,
    cogs: round2(cogs),
    grossProfit: round2(totals.revenue - cogs),
  };
};

const purchasesTotalsInRange = async (start, end) => {
  const [result] = await Purchase.aggregate([
    { $match: { status: "received", createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: null,
        expenditure: { $sum: "$total" },
        paid: { $sum: "$amountPaid" },
        outstanding: { $sum: "$balance" },
        count: { $sum: 1 },
      },
    },
  ]);
  const r = result[0] || { expenditure: 0, paid: 0, outstanding: 0, count: 0 };
  return { expenditure: round2(r.expenditure), paid: round2(r.paid), outstanding: round2(r.outstanding), count: r.count };
};

export const getDashboard = asyncHandler(async (req, res) => {
  const today = todayRange();
  const month = thisMonthRange();
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);

  const [
    todaySales, monthSales, allTimeSales, monthPurchases, allTimePurchases,
    totalProducts, totalCustomers, totalSuppliers, lowStockCount, inventoryAgg,
    recentSales, recentPurchases, outstandingCustomersAgg, outstandingSuppliersAgg,
    topDebtorsAgg, topSupplierDuesAgg, lowStockProducts,
    salesTrendAgg, salesByCategoryAgg, topProductsAgg
  ] = await Promise.all([
    salesTotalsInRange(today.start, today.end),
    salesTotalsInRange(month.start, month.end),
    salesTotalsInRange(new Date(0), new Date()), // All time
    purchasesTotalsInRange(month.start, month.end),
    purchasesTotalsInRange(new Date(0), new Date()),
    Product.countDocuments({ isActive: true }),
    Customer.countDocuments({ isActive: true }),
    Supplier.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, $expr: { $lte: ["$stockQuantity", "$minStockLevel"] } }),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, value: { $sum: { $multiply: ["$purchasePrice", "$stockQuantity"] } }, totalStockUnits: { $sum: "$stockQuantity" } } },
    ]),
    Sale.find().sort({ createdAt: -1 }).limit(5).select("invoiceNumber customerName total amountPaid balance paymentStatus status createdAt paymentMethod"),
    Purchase.find().sort({ createdAt: -1 }).limit(5).select("purchaseNumber supplierName total amountPaid balance status createdAt"),
    Sale.aggregate([{ $match: { status: "completed", balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$balance" } } }]),
    Purchase.aggregate([{ $match: { status: "received", balance: { $gt: 0 } } }, { $group: { _id: null, total: { $sum: "$balance" } } }]),
    Sale.aggregate([{ $match: { status: "completed", balance: { $gt: 0 }, customer: { $ne: null } } }, { $group: { _id: "$customer", customerName: { $first: "$customerName" }, outstanding: { $sum: "$balance" }, invoiceCount: { $sum: 1 } } }, { $sort: { outstanding: -1 } }, { $limit: 5 }]),
    Purchase.aggregate([{ $match: { status: "received", balance: { $gt: 0 } } }, { $group: { _id: "$supplier", supplierName: { $first: "$supplierName" }, outstanding: { $sum: "$balance" }, purchaseCount: { $sum: 1 } } }, { $sort: { outstanding: -1 } }, { $limit: 5 }]),
    Product.find({ isActive: true, $expr: { $lte: ["$stockQuantity", "$minStockLevel"] } }).populate("category", "name").sort({ stockQuantity: 1 }).limit(5).select("name sku stockQuantity minStockLevel unit category"),
    
    // Charts
    Sale.aggregate([
      { $match: { status: "completed", createdAt: { $gte: last7Days } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, sales: { $sum: "$total" } } },
      { $sort: { _id: 1 } }
    ]),
    Sale.aggregate([
      { $match: { status: "completed" } },
      { $unwind: "$items" },
      { $lookup: { from: "products", localField: "items.product", foreignField: "_id", as: "productDoc" } },
      { $unwind: "$productDoc" },
      { $lookup: { from: "categories", localField: "productDoc.category", foreignField: "_id", as: "categoryDoc" } },
      { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ["$categoryDoc.name", "Uncategorized"] }, value: { $sum: "$items.subtotal" } } },
      { $sort: { value: -1 } }
    ]),
    Sale.aggregate([
      { $match: { status: "completed" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.product", name: { $first: "$items.name" }, sku: { $first: "$items.sku" }, quantity: { $sum: "$items.quantity" }, revenue: { $sum: "$items.subtotal" } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ])
  ]);

  const inventory = inventoryAgg[0] || { value: 0, totalStockUnits: 0 };
  const outstandingCustomers = outstandingCustomersAgg[0]?.total || 0;
  const outstandingSuppliers = outstandingSuppliersAgg[0]?.total || 0;

  res.status(200).json({
    success: true,
    data: {
      today: { 
        sales: todaySales.revenue, 
        transactions: todaySales.transactionCount,
        collected: todaySales.collected,
        outstanding: todaySales.outstanding,
        cogs: todaySales.cogs,
        grossProfit: todaySales.grossProfit
      },
      month: {
        sales: monthSales.revenue, salesTransactions: monthSales.transactionCount, salesCollected: monthSales.collected,
        salesOutstanding: monthSales.outstanding, salesProfit: monthSales.grossProfit,
        purchaseExpenditure: monthPurchases.expenditure, purchaseCount: monthPurchases.count, purchasePaid: monthPurchases.paid, purchaseOutstanding: monthPurchases.outstanding,
      },
      allTime: {
        sales: allTimeSales.revenue, salesTransactions: allTimeSales.transactionCount, salesCollected: allTimeSales.collected,
        salesOutstanding: allTimeSales.outstanding, salesProfit: allTimeSales.grossProfit,
        purchaseExpenditure: allTimePurchases.expenditure, purchaseCount: allTimePurchases.count, purchasePaid: allTimePurchases.paid, purchaseOutstanding: allTimePurchases.outstanding,
      },
      counts: { products: totalProducts, customers: totalCustomers, suppliers: totalSuppliers, lowStockProducts: lowStockCount },
      balances: { customerOutstanding: round2(outstandingCustomers), supplierOutstanding: round2(outstandingSuppliers) },
      inventory: { valueAtCost: round2(inventory.value), totalUnits: inventory.totalStockUnits },
      recent: { sales: recentSales, purchases: recentPurchases },
      topDebtors: topDebtorsAgg.map(d => ({ customer: d._id, name: d.customerName, outstanding: round2(d.outstanding), invoiceCount: d.invoiceCount })),
      topSupplierDues: topSupplierDuesAgg.map(s => ({ supplier: s._id, name: s.supplierName, outstanding: round2(s.outstanding), purchaseCount: s.purchaseCount })),
      lowStockProducts,
      salesTrend: salesTrendAgg.map(t => ({ date: t._id, sales: round2(t.sales) })),
      salesByCategory: salesByCategoryAgg.map(c => ({ name: c._id, value: round2(c.value) })),
      topProducts: topProductsAgg.map(p => ({ id: p._id, name: p.name, sku: p.sku, quantity: p.quantity, revenue: round2(p.revenue) }))
    },
  });
});