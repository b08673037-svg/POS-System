/**
 * Wraps an async route handler so that any rejected promise
 * is automatically forwarded to Express's error handler.
 *
 * Without this, you would need try/catch inside EVERY controller.
 * With it, you just `throw new Error(...)` and the central
 * errorMiddleware.js handles the response.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export default asyncHandler;