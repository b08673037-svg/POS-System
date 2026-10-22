import express from "express";
import {
  createSale,
  getSales,
  getSaleById,
  getDailySalesSummary,
  updateSale,
  cancelSale,
  getSaleNotifications,
  retrySaleNotification,
} from "../controllers/saleController.js";

const router = express.Router();

router
  .route("/")
  .get(getSales) // GET    /api/sales
  .post(createSale); // POST   /api/sales

// Specific paths FIRST — must come before /:id
router.get("/summary/daily", getDailySalesSummary); // GET /api/sales/summary/daily
router.get("/:id/notifications", getSaleNotifications); // GET /api/sales/:id/notifications
router.post("/:id/retry-notifications", retrySaleNotification); // POST /api/sales/:id/retry-notifications
router.patch("/:id/cancel", cancelSale); // PATCH /api/sales/:id/cancel

router
  .route("/:id")
  .get(getSaleById) // GET    /api/sales/:id
  .put(updateSale); // PUT    /api/sales/:id

export default router;