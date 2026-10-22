import express from "express";
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from "../controllers/supplierController.js";

const router = express.Router();

router
  .route("/")
  .get(getSuppliers)      // GET    /api/suppliers
  .post(createSupplier);  // POST   /api/suppliers

router
  .route("/:id")
  .get(getSupplierById)   // GET    /api/suppliers/:id
  .put(updateSupplier)    // PUT    /api/suppliers/:id
  .delete(deleteSupplier);// DELETE /api/suppliers/:id

export default router;