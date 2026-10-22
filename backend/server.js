import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { verifyEmailConfiguration } from "./services/emailService.js";

import authRoutes from "./routes/authRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

dotenv.config();
connectDB();
verifyEmailConfiguration();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "POS API is running",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ---------- Auth (public + protected mix — see authRoutes.js) ----------
app.use("/api/auth", authRoutes);

// ---------- Everything else (all still open for now) ----------
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}/api/health`);
});