import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
} from "../controllers/productController.js";

const router = express.Router();

router
  .route("/")
  .get(getProducts)     // GET    /api/products
  .post(createProduct); // POST   /api/products

// IMPORTANT: /low-stock must be defined BEFORE /:id,
// otherwise Express matches "low-stock" as an :id value.
router.get("/low-stock", getLowStockProducts);

router
  .route("/:id")
  .get(getProductById)   // GET    /api/products/:id
  .put(updateProduct)    // PUT    /api/products/:id
  .delete(deleteProduct);// DELETE /api/products/:id

export default router;