import Customer from "../models/Customer.js";
import asyncHandler from "../middleware/asyncHandler.js";

/**
 * @desc    Create a customer
 * @route   POST /api/customers
 * @access  Public
 */
export const createCustomer = asyncHandler(async (req, res) => {
  const { fullName, phone, email, address, notes } = req.body;

  // Basic guard — schema will also enforce this, but the pre-check
  // gives a cleaner message than the raw Mongoose validator output.
  if (!fullName || !fullName.trim()) {
    res.status(400);
    throw new Error("Customer full name is required");
  }

  const customer = await Customer.create({
    fullName: fullName.trim(),
    phone: phone ? phone.trim() : "",
    email: email ? email.trim().toLowerCase() : "",
    address: address ? address.trim() : "",
    notes: notes ? notes.trim() : "",
  });

  res.status(201).json({
    success: true,
    message: "Customer created successfully",
    data: customer,
  });
});

/**
 * @desc    List customers (search + pagination)
 * @route   GET /api/customers
 * @access  Public
 */
export const getCustomers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const search = req.query.search ? req.query.search.trim() : "";

  const filter = { isActive: true };

  if (search) {
    const rx = { $regex: search, $options: "i" };
    filter.$or = [{ fullName: rx }, { phone: rx }, { email: rx }];
  }

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: customers.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: customers,
  });
});

/**
 * @desc    Get a single customer
 * @route   GET /api/customers/:id
 * @access  Public
 */
export const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  res.status(200).json({ success: true, data: customer });
});

/**
 * @desc    Update a customer
 * @route   PUT /api/customers/:id
 * @access  Public
 *
 * Note: Historical sales reference the customer's _id and store their
 * own snapshot of the name/phone. Editing the customer does NOT change
 * what old invoices show. That is by design.
 */
export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  const allowedFields = ["fullName", "phone", "email", "address", "notes"];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      let value = req.body[field];
      if (typeof value === "string") value = value.trim();
      if (field === "email") value = value.toLowerCase();
      customer[field] = value;
    }
  }

  if (!customer.fullName || !customer.fullName.trim()) {
    res.status(400);
    throw new Error("Customer full name cannot be empty");
  }

  const updated = await customer.save();

  res.status(200).json({
    success: true,
    message: "Customer updated successfully",
    data: updated,
  });
});

/**
 * @desc    Delete a customer (soft delete)
 * @route   DELETE /api/customers/:id
 * @access  Public
 *
 * Soft delete preserves historical sales. The customer disappears from
 * lists but the record remains intact in MongoDB, so sale history and
 * outstanding balances remain accurate.
 */
export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);

  if (!customer) {
    res.status(404);
    throw new Error("Customer not found");
  }

  customer.isActive = false;
  await customer.save();

  res.status(200).json({
    success: true,
    message: "Customer deactivated successfully",
    data: { _id: customer._id, isActive: customer.isActive },
  });
});