import Sale from "../models/Sale.js";
import Purchase from "../models/Purchase.js";
import asyncHandler from "../middleware/asyncHandler.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Parse `from` and `to` query params into a Date range.
 *   - `to` defaults to end of today
 *   - `from` defaults to 29 days before `to` (a 30-day window)
 * Both are expanded to cover full days (00:00:00 → 23:59:59).
 */
const parseRange = (query) => {
  const to = query.to ? new Date(query.to) : new Date();
  to.setHours(23, 59, 59, 999);

  const from = query.from
    ? new Date(query.from)
    : new Date(to.getFullYear(), to.getMonth(), to.getDate() - 29);
  from.setHours(0, 0, 0, 0);

  return { from, to };
};

/**
 * @desc    Aggregate reports for a date range
 * @route   GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
 * @access  Public
 *
 * Returns one object with:
 *   - range            { from, to }
 *   - sales            totals: revenue, collected, outstanding, COGS, profit, margin
 *   - purchases        totals: expenditure, paid, outstanding, count
 *   - topProducts      top 10 by revenue in the range
 *   - topCustomers     top 10 by revenue in the range
 *   - daily            day-by-day totals for a bar chart
 *   - paymentBreakdown per method: count + revenue
 *
 * Cancelled sales and non-received purchases are excluded from every metric.
 */
export const getReports = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const rangeMatch = { createdAt: { $gte: from, $lte: to } };

  /* ---------- SALES ---------- */
  const [salesAgg] = await Sale.aggregate([
    { $match: { ...rangeMatch, status: "completed" } },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              revenue: { $sum: "$total" },
              collected: { $sum: "$amountPaid" },
              outstanding: { $sum: "$balance" },
              count: { $sum: 1 },
              discount: { $sum: "$discount" },
              tax: { $sum: "$tax" },
            },
          },
        ],
        cogs: [
          { $unwind: "$items" },
          {
            $group: {
              _id: null,
              cogs: {
                $sum: {
                  $multiply: ["$items.costPrice", "$items.quantity"],
                },
              },
            },
          },
        ],
      },
    },
  ]);

  const st = salesAgg?.totals?.[0] || {
    revenue: 0,
    collected: 0,
    outstanding: 0,
    count: 0,
    discount: 0,
    tax: 0,
  };
  const cogs = salesAgg?.cogs?.[0]?.cogs || 0;
  const revenue = round2(st.revenue);
  const grossProfit = round2(revenue - cogs);

  /* ---------- PURCHASES ---------- */
  const [purchaseAgg] = await Purchase.aggregate([
    { $match: { ...rangeMatch, status: "received" } },
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
  const pt = purchaseAgg[0] || {
    expenditure: 0,
    paid: 0,
    outstanding: 0,
    count: 0,
  };

  /* ---------- TOP PRODUCTS ---------- */
  const topProducts = await Sale.aggregate([
    { $match: { ...rangeMatch, status: "completed" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $first: "$items.name" },
        sku: { $first: "$items.sku" },
        unitsSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.subtotal" },
        cogs: {
          $sum: {
            $multiply: ["$items.costPrice", "$items.quantity"],
          },
        },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
  ]);

  /* ---------- TOP CUSTOMERS ---------- */
  const topCustomers = await Sale.aggregate([
    {
      $match: {
        ...rangeMatch,
        status: "completed",
        customer: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$customer",
        name: { $first: "$customerName" },
        phone: { $first: "$customerPhone" },
        invoiceCount: { $sum: 1 },
        revenue: { $sum: "$total" },
        outstanding: { $sum: "$balance" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
  ]);

  /* ---------- DAILY BREAKDOWN ---------- */
  const dailyRaw = await Sale.aggregate([
    { $match: { ...rangeMatch, status: "completed" } },
    {
      $group: {
        _id: {
          y: { $year: "$createdAt" },
          m: { $month: "$createdAt" },
          d: { $dayOfMonth: "$createdAt" },
        },
        revenue: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
  ]);

  const daily = dailyRaw.map((d) => ({
    date: `${d._id.y}-${String(d._id.m).padStart(2, "0")}-${String(
      d._id.d
    ).padStart(2, "0")}`,
    revenue: round2(d.revenue),
    count: d.count,
  }));

  /* ---------- PAYMENT METHOD BREAKDOWN ---------- */
  const paymentBreakdown = await Sale.aggregate([
    { $match: { ...rangeMatch, status: "completed" } },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        revenue: { $sum: "$total" },
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  /* ---------- RESPONSE ---------- */
  res.status(200).json({
    success: true,
    data: {
      range: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      sales: {
        revenue,
        collected: round2(st.collected),
        outstanding: round2(st.outstanding),
        count: st.count,
        discount: round2(st.discount),
        tax: round2(st.tax),
        cogs: round2(cogs),
        grossProfit,
        grossMarginPct:
          revenue > 0 ? round2((grossProfit / revenue) * 100) : 0,
      },
      purchases: {
        expenditure: round2(pt.expenditure),
        paid: round2(pt.paid),
        outstanding: round2(pt.outstanding),
        count: pt.count,
      },
      topProducts: topProducts.map((p) => ({
        product: p._id,
        name: p.name,
        sku: p.sku,
        unitsSold: p.unitsSold,
        revenue: round2(p.revenue),
        profit: round2(p.revenue - p.cogs),
      })),
      topCustomers: topCustomers.map((c) => ({
        customer: c._id,
        name: c.name,
        phone: c.phone,
        invoiceCount: c.invoiceCount,
        revenue: round2(c.revenue),
        outstanding: round2(c.outstanding),
      })),
      daily,
      paymentBreakdown: paymentBreakdown.map((p) => ({
        method: p._id,
        count: p.count,
        revenue: round2(p.revenue),
      })),
    },
  });
});