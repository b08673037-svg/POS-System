import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import User from "../models/User.js";

/**
 * Require a valid JWT. Attaches the user document to req.user.
 * Used on every protected route.
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  let token = null;

  // Standard Bearer format: "Authorization: Bearer <token>"
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    token = header.slice(7).trim();
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized — no token provided");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    res.status(401);
    throw new Error(
      err.name === "TokenExpiredError"
        ? "Session expired — please log in again"
        : "Invalid token"
    );
  }

  // Confirm the user still exists and is active.
  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error("Account is no longer active");
  }

  req.user = user;
  next();
});

/**
 * Role gate. Usage:
 *   router.post("/users", requireAuth, requireRole("admin"), handler)
 *
 * Accepts one or more role names.
 */
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    res.status(401);
    return next(new Error("Not authenticated"));
  }
  if (!allowedRoles.includes(req.user.role)) {
    res.status(403);
    return next(new Error("You do not have permission to perform this action"));
  }
  next();
};