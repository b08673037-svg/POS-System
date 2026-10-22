import express from "express";
import {
  createPurchase,
  getPurchases,
  getPurchaseById,
  receivePurchase,
  updatePurchase,
  cancelPurchase,
} from "../controllers/purchaseController.js";

const router = express.Router();

router
  .route("/")
  .get(getPurchases)      // GET    /api/purchases
  .post(createPurchase);  // POST   /api/purchases

// Specific action routes — MUST come before the generic /:id GET/PUT
router.patch("/:id/receive", receivePurchase); // PATCH /api/purchases/:id/receive
router.patch("/:id/cancel", cancelPurchase);   // PATCH /api/purchases/:id/cancel

router
  .route("/:id")
  .get(getPurchaseById)   // GET    /api/purchases/:id
  .put(updatePurchase);   // PUT    /api/purchases/:id

export default router;