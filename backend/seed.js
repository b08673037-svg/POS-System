import mongoose from "mongoose";
import dotenv from "dotenv";

import Category from "./models/Category.js";
import Product from "./models/Product.js";
import Customer from "./models/Customer.js";
import Supplier from "./models/Supplier.js";
import Purchase from "./models/Purchase.js";
import Sale from "./models/Sale.js";

dotenv.config();

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Build a fake ObjectId-style invoice/purchase number
 * so the seed data looks realistic.
 */
const dateStamp = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected: ${mongoose.connection.name}`);

    // ---- Clear existing data ----
    await Promise.all([
      Category.deleteMany({}),
      Product.deleteMany({}),
      Customer.deleteMany({}),
      Supplier.deleteMany({}),
      Purchase.deleteMany({}),
      Sale.deleteMany({}),
    ]);
    console.log("🧹 Cleared all existing records");

    /* =========================================================
     *  CATEGORIES
     * ========================================================= */
    const [catBev, catSnacks, catDairy] = await Category.insertMany([
      { name: "Beverages", description: "Soft drinks, juices, water" },
      { name: "Snacks", description: "Chips, biscuits, chocolates" },
      { name: "Dairy", description: "Milk, yogurt, cheese" },
    ]);
    console.log("📁 Created 3 categories");

    /* =========================================================
     *  PRODUCTS  (stock starts at 0; purchases and sales will adjust)
     * ========================================================= */
    const products = await Product.insertMany([
      {
        name: "Coca-Cola 500ml",
        sku: "BEV-CC-500",
        barcode: "5449000000996",
        category: catBev._id,
        purchasePrice: 1.10,
        sellingPrice: 2.00,
        stockQuantity: 0,
        minStockLevel: 20,
        unit: "bottle",
        description: "Chilled Coca-Cola 500ml bottle",
      },
      {
        name: "Pepsi 500ml",
        sku: "BEV-PEP-500",
        barcode: "5449000001001",
        category: catBev._id,
        purchasePrice: 1.05,
        sellingPrice: 1.90,
        stockQuantity: 0,
        minStockLevel: 15,
        unit: "bottle",
        description: "Pepsi 500ml bottle",
      },
      {
        name: "Lays Classic 50g",
        sku: "SNK-LAY-050",
        barcode: "5449000002002",
        category: catSnacks._id,
        purchasePrice: 0.60,
        sellingPrice: 1.20,
        stockQuantity: 0,
        minStockLevel: 30,
        unit: "pack",
        description: "Lays Classic salted potato chips",
      },
      {
        name: "Oreo Pack 154g",
        sku: "SNK-ORO-154",
        barcode: "5449000003003",
        category: catSnacks._id,
        purchasePrice: 1.50,
        sellingPrice: 2.80,
        stockQuantity: 0,
        minStockLevel: 10,
        unit: "pack",
        description: "Oreo chocolate sandwich cookies",
      },
      {
        name: "Full Cream Milk 1L",
        sku: "DRY-MLK-1L",
        barcode: "5449000004004",
        category: catDairy._id,
        purchasePrice: 0.90,
        sellingPrice: 1.50,
        stockQuantity: 0,
        minStockLevel: 25,
        unit: "liter",
        description: "Full cream fresh milk 1 liter",
      },
    ]);
    console.log("📦 Created 5 products");

    const [P1, P2, P3, P4, P5] = products;
    // P1 = Coca-Cola, P2 = Pepsi, P3 = Lays, P4 = Oreo, P5 = Milk

    /* =========================================================
     *  SUPPLIERS
     * ========================================================= */
    const [supBev, supSnacks] = await Supplier.insertMany([
      {
        name: "Global Beverages Ltd.",
        contactPerson: "Bilal Ahmed",
        phone: "02112345678",
        email: "sales@globalbev.example",
        address: "Plot 42, Industrial Area, Karachi",
        notes: "Weekly delivery every Monday",
      },
      {
        name: "Snack Distributors Co.",
        contactPerson: "Sara Khan",
        phone: "04298765432",
        email: "orders@snackdist.example",
        address: "22 Ring Road, Lahore",
        notes: "Bulk orders above $500 get 5% off",
      },
    ]);
    console.log("🚚 Created 2 suppliers");

    /* =========================================================
     *  CUSTOMERS
     * ========================================================= */
    const [custAhmed, custFatima] = await Customer.insertMany([
      {
        fullName: "Ahmed Khan",
        phone: "03001234567",
        email: "ahmed.khan@example.com",
        address: "12 Main Street, Karachi",
        notes: "Regular customer, prefers card payment",
      },
      {
        fullName: "Fatima Ali",
        phone: "03217654321",
        email: "fatima.ali@example.com",
        address: "88 Garden Road, Lahore",
        notes: "Buys in bulk for family events",
      },
    ]);
    console.log("👥 Created 2 customers");

    /* =========================================================
     *  PURCHASE 1  (received — increases stock)
     * ========================================================= */
    const purchase1Items = [
      {
        product: P1._id,
        name: P1.name,
        sku: P1.sku,
        quantity: 50,
        purchasePrice: 1.10,
        subtotal: round2(50 * 1.10),
      },
      {
        product: P2._id,
        name: P2.name,
        sku: P2.sku,
        quantity: 30,
        purchasePrice: 1.05,
        subtotal: round2(30 * 1.05),
      },
      {
        product: P3._id,
        name: P3.name,
        sku: P3.sku,
        quantity: 100,
        purchasePrice: 0.60,
        subtotal: round2(100 * 0.60),
      },
    ];

    const p1Subtotal = round2(purchase1Items.reduce((s, i) => s + i.subtotal, 0));
    const p1Total = round2(p1Subtotal - 5); // $5 discount
    const p1Paid = p1Total; // fully paid

    const purchase1 = await Purchase.create({
      purchaseNumber: `PUR-${dateStamp()}-0001`,
      supplier: supBev._id,
      supplierName: supBev.name,
      items: purchase1Items,
      subtotal: p1Subtotal,
      discount: 5,
      tax: 0,
      total: p1Total,
      amountPaid: p1Paid,
      balance: round2(p1Total - p1Paid),
      paymentMethod: "bank-transfer",
      status: "received",
      stockApplied: true,
    });

    // Increase stock to reflect receipt
    for (const item of purchase1Items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stockQuantity: item.quantity } }
      );
    }
    console.log("🛒 Created 1 received purchase (stock increased)");

    /* =========================================================
     *  PURCHASE 2  (pending — no stock effect yet)
     * ========================================================= */
    const purchase2Items = [
      {
        product: P4._id,
        name: P4.name,
        sku: P4.sku,
        quantity: 40,
        purchasePrice: 1.50,
        subtotal: round2(40 * 1.50),
      },
      {
        product: P5._id,
        name: P5.name,
        sku: P5.sku,
        quantity: 60,
        purchasePrice: 0.90,
        subtotal: round2(60 * 0.90),
      },
    ];

    const p2Subtotal = round2(purchase2Items.reduce((s, i) => s + i.subtotal, 0));
    const p2Total = p2Subtotal;
    const p2Paid = 0;

    await Purchase.create({
      purchaseNumber: `PUR-${dateStamp()}-0002`,
      supplier: supSnacks._id,
      supplierName: supSnacks.name,
      items: purchase2Items,
      subtotal: p2Subtotal,
      discount: 0,
      tax: 0,
      total: p2Total,
      amountPaid: p2Paid,
      balance: round2(p2Total - p2Paid),
      paymentMethod: "credit",
      status: "pending",
      stockApplied: false,
    });
    console.log("📋 Created 1 pending purchase (no stock effect)");

    /* =========================================================
     *  SALE 1  (Ahmed — fully paid)
     * ========================================================= */
    const sale1Items = [
      {
        product: P1._id,
        name: P1.name,
        sku: P1.sku,
        quantity: 3,
        sellingPrice: 2.00,
        costPrice: 1.10,
        subtotal: round2(3 * 2.00),
      },
      {
        product: P2._id,
        name: P2.name,
        sku: P2.sku,
        quantity: 2,
        sellingPrice: 1.90,
        costPrice: 1.05,
        subtotal: round2(2 * 1.90),
      },
    ];

    const s1Subtotal = round2(sale1Items.reduce((s, i) => s + i.subtotal, 0));
    const s1Total = s1Subtotal;
    const s1Paid = s1Total;

    const sale1 = await Sale.create({
      invoiceNumber: `INV-${dateStamp()}-0001`,
      customer: custAhmed._id,
      customerName: custAhmed.fullName,
      customerPhone: custAhmed.phone,
      items: sale1Items,
      subtotal: s1Subtotal,
      discount: 0,
      tax: 0,
      total: s1Total,
      amountPaid: s1Paid,
      balance: 0,
      paymentMethod: "card",
      paymentStatus: "paid",
      status: "completed",
      stockApplied: true,
      stockRestored: false,
    });

    for (const item of sale1Items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stockQuantity: -item.quantity } }
      );
    }
    console.log("💰 Created sale 1 (fully paid, card)");

    /* =========================================================
     *  SALE 2  (Ahmed — partial payment)
     * ========================================================= */
    const sale2Items = [
      {
        product: P3._id,
        name: P3.name,
        sku: P3.sku,
        quantity: 5,
        sellingPrice: 1.20,
        costPrice: 0.60,
        subtotal: round2(5 * 1.20),
      },
    ];

    const s2Subtotal = round2(sale2Items.reduce((s, i) => s + i.subtotal, 0));
    const s2Total = s2Subtotal;
    const s2Paid = 3.00; // partial

    const sale2 = await Sale.create({
      invoiceNumber: `INV-${dateStamp()}-0002`,
      customer: custFatima._id,
      customerName: custFatima.fullName,
      customerPhone: custFatima.phone,
      items: sale2Items,
      subtotal: s2Subtotal,
      discount: 0,
      tax: 0,
      total: s2Total,
      amountPaid: s2Paid,
      balance: round2(s2Total - s2Paid),
      paymentMethod: "credit",
      paymentStatus: "partial",
      status: "completed",
      stockApplied: true,
      stockRestored: false,
    });

    for (const item of sale2Items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stockQuantity: -item.quantity } }
      );
    }
    console.log("💰 Created sale 2 (partial payment, credit)");

    /* =========================================================
     *  SALE 3  (Walk-in — fully paid)
     * ========================================================= */
    const sale3Items = [
      {
        product: P1._id,
        name: P1.name,
        sku: P1.sku,
        quantity: 2,
        sellingPrice: 2.00,
        costPrice: 1.10,
        subtotal: round2(2 * 2.00),
      },
    ];

    const s3Subtotal = round2(sale3Items.reduce((s, i) => s + i.subtotal, 0));
    const s3Total = s3Subtotal;
    const s3Paid = s3Total;

    const sale3 = await Sale.create({
      invoiceNumber: `INV-${dateStamp()}-0003`,
      customer: null,
      customerName: "Walk-in Customer",
      customerPhone: "",
      items: sale3Items,
      subtotal: s3Subtotal,
      discount: 0,
      tax: 0,
      total: s3Total,
      amountPaid: s3Paid,
      balance: 0,
      paymentMethod: "cash",
      paymentStatus: "paid",
      status: "completed",
      stockApplied: true,
      stockRestored: false,
    });

    for (const item of sale3Items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stockQuantity: -item.quantity } }
      );
    }
    console.log("💰 Created sale 3 (walk-in, cash)");

    /* =========================================================
     *  SALE 4  (Cancelled — stock was applied and then restored)
     * ========================================================= */
    const sale4Items = [
      {
        product: P1._id,
        name: P1.name,
        sku: P1.sku,
        quantity: 1,
        sellingPrice: 2.00,
        costPrice: 1.10,
        subtotal: round2(1 * 2.00),
      },
    ];

    const sale4 = await Sale.create({
      invoiceNumber: `INV-${dateStamp()}-0004`,
      customer: custAhmed._id,
      customerName: custAhmed.fullName,
      customerPhone: custAhmed.phone,
      items: sale4Items,
      subtotal: 2.00,
      discount: 0,
      tax: 0,
      total: 2.00,
      amountPaid: 0,
      balance: 2.00,
      paymentMethod: "cash",
      paymentStatus: "unpaid",
      status: "cancelled",
      stockApplied: false,
      stockRestored: true,
      cancelledAt: new Date(),
      cancelReason: "Customer changed their mind",
    });
    // No stock change — the sale was created then immediately cancelled,
    // so the net effect on stock is zero.
    console.log("🚫 Created sale 4 (cancelled)");

    /* =========================================================
     *  FINAL SUMMARY
     * ========================================================= */
    const finalProducts = await Product.find().select(
      "name sku stockQuantity minStockLevel"
    );

    console.log("\n📊 Final stock levels:");
    finalProducts.forEach((p) => {
      const low = p.stockQuantity <= p.minStockLevel ? " ⚠️ LOW" : "";
      console.log(`   ${p.name.padEnd(22)} ${p.stockQuantity}${low}`);
    });

    console.log("\n✅ Seed complete. Open the frontend at http://localhost:5173");
    console.log("   → Dashboard shows live numbers");
    console.log("   → Products / Customers / Suppliers have records to list\n");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();