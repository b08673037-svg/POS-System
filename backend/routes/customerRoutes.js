import express from "express";
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customerController.js";

const router = express.Router();

router
  .route("/")
  .get(getCustomers)      // GET    /api/customers
  .post(createCustomer);  // POST   /api/customers

router
  .route("/:id")
  .get(getCustomerById)   // GET    /api/customers/:id
  .put(updateCustomer)    // PUT    /api/customers/:id
  .delete(deleteCustomer);// DELETE /api/customers/:id

export default router;