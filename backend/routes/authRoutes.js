import express from "express";
import rateLimit from "express-rate-limit";
import {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  verifyOtp, // <-- IMPORT THIS
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many attempts. Please try again later." },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/verify-otp", authLimiter, verifyOtp); // <-- ADD THIS
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password/:token", authLimiter, resetPassword);

router.get("/me", requireAuth, getMe);
router.post("/logout", requireAuth, logout);

export default router;