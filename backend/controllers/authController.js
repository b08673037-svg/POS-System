import crypto from "crypto";
import jwt from "jsonwebtoken";
import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/User.js";
import { sendEmail, storeInfo, isEmailEnabled } from "../services/emailService.js";
import { buildPasswordResetEmail } from "../templates/passwordResetEmail.js";
import { buildOtpEmail } from "../templates/otpEmail.js";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const signToken = (user) =>
  jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

/* ---------------------------------------------------------------
 *  POST /api/auth/register
 * --------------------------------------------------------------- */
export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !name.trim() || !email || !/^\S+@\S+\.\S+$/.test(String(email).trim()) || !password || password.length < 8) {
    res.status(400);
    throw new Error("Please provide a valid name, email, and password (min 8 chars).");
  }

  const normalized = String(email).trim().toLowerCase();
  const existing = await User.findOne({ email: normalized });

  if (existing) {
    if (!existing.isVerified) {
       // Optional: You could resend the OTP here, but for simplicity we'll just prompt them to login or verify
       res.status(400);
       throw new Error("Account exists but is unverified. Please check your email for the OTP.");
    }
    res.status(400);
    throw new Error("An account with this email already exists");
  }

  const role = process.env.NODE_ENV === "development" && (await User.countDocuments()) === 0 ? "admin" : "cashier";

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otpCode).digest("hex");

  const user = await User.create({
    name: name.trim(),
    email: normalized,
    phone: phone ? String(phone).trim() : "",
    password,
    role,
    isVerified: false,
    otp: hashedOtp,
    otpExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  // Send Email
  if (isEmailEnabled()) {
    const { subject, html, text } = buildOtpEmail({
      name: user.name,
      otp: otpCode,
      storeName: storeInfo.name,
    });
    // Fire and forget
    sendEmail({ to: user.email, subject, html, text }).catch(err => console.error("OTP Email failed:", err.message));
  } else {
    console.warn("⚠️ Email disabled. Your OTP code is:", otpCode);
  }

  // Do NOT send token yet. User must verify first.
  res.status(201).json({
    success: true,
    message: "Account created. Please check your email for the verification code.",
    data: { email: user.email },
  });
});

/* ---------------------------------------------------------------
 *  POST /api/auth/verify-otp
 * --------------------------------------------------------------- */
export const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error("Email and OTP code are required");
  }

  const hashedOtp = crypto.createHash("sha256").update(otp.trim()).digest("hex");

  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
    otp: hashedOtp,
    otpExpires: { $gt: new Date() }, // Ensure it hasn't expired
  }).select("+otp +otpExpires");

  if (!user) {
    res.status(400);
    throw new Error("Invalid or expired verification code");
  }

  // Mark as verified and clear OTP fields
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();

  // Auto-login after successful verification
  const token = signToken(user);

  res.status(200).json({
    success: true,
    message: "Account verified successfully",
    data: { user, token },
  });
});

/* ---------------------------------------------------------------
 *  POST /api/auth/login
 * --------------------------------------------------------------- */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
  }).select("+password");

  if (!user || !user.isActive || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (!user.isVerified) {
    res.status(403); // Forbidden
    throw new Error("Please verify your email address before logging in.");
  }

  const token = signToken(user);
  user.password = undefined;

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: { user, token },
  });
});

/* ---------------------------------------------------------------
 *  Other functions (getMe, logout, forgotPassword, resetPassword)
 *  remain exactly as they were in your previous code.
 * --------------------------------------------------------------- */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: { user: req.user } });
});

export const logout = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, message: "Logged out" });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const genericResponse = { success: true, message: "If an account exists, a reset link has been sent." };

  if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) return res.status(200).json(genericResponse);

  const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select("+resetPasswordToken +resetPasswordExpires");
  if (!user || !user.isActive) return res.status(200).json(genericResponse);

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.resetPasswordToken = hashed;
  user.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`;

  if (isEmailEnabled()) {
    const { subject, html, text } = buildPasswordResetEmail({ name: user.name, resetUrl, storeName: storeInfo.name });
    sendEmail({ to: user.email, subject, html, text }).catch((err) => console.error(err));
  }

  return res.status(200).json(genericResponse);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    res.status(400);
    throw new Error("Password must be at least 8 characters");
  }

  const hashed = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashed,
    resetPasswordExpires: { $gt: new Date() },
  }).select("+password +resetPasswordToken +resetPasswordExpires");

  if (!user) {
    res.status(400);
    throw new Error("Reset link is invalid or has expired");
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.status(200).json({ success: true, message: "Password has been reset." });
});