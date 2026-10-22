/**
 * Catches any request that did not match a defined route
 * and forwards a 404 error to the error handler below.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error); // passes the error to errorHandler
};

/**
 * Centralized error handler.
 * Express recognizes this as an error handler because it has 4 arguments.
 * Must be registered LAST in server.js, after all routes.
 */
const errorHandler = (err, req, res, next) => {
  // If a controller set a status code, keep it. Otherwise treat as 500.
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Mongoose throws a CastError for malformed ObjectIds (e.g. /api/products/abc)
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  // Mongoose duplicate key error (e.g. duplicate SKU or category name)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  // Mongoose schema validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Stack traces are helpful in development, dangerous in production
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

export { notFound, errorHandler };