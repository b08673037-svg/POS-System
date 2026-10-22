import express from "express";
import { getNotifications } from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getNotifications);

export default router;