import express from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

router
  .route("/")
  .get(getCategories)     // GET    /api/categories
  .post(createCategory);  // POST   /api/categories

router
  .route("/:id")
  .get(getCategoryById)   // GET    /api/categories/:id
  .put(updateCategory)    // PUT    /api/categories/:id
  .delete(deleteCategory);// DELETE /api/categories/:id

export default router;