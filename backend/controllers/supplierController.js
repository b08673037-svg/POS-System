import Supplier from "../models/Supplier.js";
import asyncHandler from "../middleware/asyncHandler.js";

/**
 * @desc    Create a supplier
 * @route   POST /api/suppliers
 * @access  Public
 */
export const createSupplier = asyncHandler(async (req, res) => {
  const { name, contactPerson, phone, email, address, notes } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Supplier name is required");
  }

  // Pre-check for a clean error message; schema's unique index also enforces this.
  const existing = await Supplier.findOne({ name: name.trim() });
  if (existing) {
    res.status(400);
    throw new Error("A supplier with this name already exists");
  }

  const supplier = await Supplier.create({
    name: name.trim(),
    contactPerson: contactPerson ? contactPerson.trim() : "",
    phone: phone ? phone.trim() : "",
    email: email ? email.trim().toLowerCase() : "",
    address: address ? address.trim() : "",
    notes: notes ? notes.trim() : "",
  });

  res.status(201).json({
    success: true,
    message: "Supplier created successfully",
    data: supplier,
  });
});

/**
 * @desc    List suppliers (search + pagination)
 * @route   GET /api/suppliers
 * @access  Public
 */
export const getSuppliers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const search = req.query.search ? req.query.search.trim() : "";

  const filter = { isActive: true };

  if (search) {
    const rx = { $regex: search, $options: "i" };
    filter.$or = [
      { name: rx },
      { contactPerson: rx },
      { phone: rx },
      { email: rx },
    ];
  }

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Supplier.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: suppliers.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: suppliers,
  });
});

/**
 * @desc    Get a single supplier
 * @route   GET /api/suppliers/:id
 * @access  Public
 */
export const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    res.status(404);
    throw new Error("Supplier not found");
  }

  res.status(200).json({ success: true, data: supplier });
});

/**
 * @desc    Update a supplier
 * @route   PUT /api/suppliers/:id
 * @access  Public
 */
export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    res.status(404);
    throw new Error("Supplier not found");
  }

  // If name is changing, ensure it stays unique
  if (req.body.name && req.body.name.trim() !== supplier.name) {
    const duplicate = await Supplier.findOne({
      name: req.body.name.trim(),
      _id: { $ne: supplier._id },
    });
    if (duplicate) {
      res.status(400);
      throw new Error("Another supplier already uses this name");
    }
    supplier.name = req.body.name.trim();
  }

  const allowedFields = ["contactPerson", "phone", "email", "address", "notes"];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      let value = req.body[field];
      if (typeof value === "string") value = value.trim();
      if (field === "email") value = value.toLowerCase();
      supplier[field] = value;
    }
  }

  const updated = await supplier.save();

  res.status(200).json({
    success: true,
    message: "Supplier updated successfully",
    data: updated,
  });
});

/**
 * @desc    Delete a supplier (soft delete)
 * @route   DELETE /api/suppliers/:id
 * @access  Public
 *
 * Soft delete preserves historical purchase records. A supplier that
 * has already been referenced by any purchase must remain queryable
 * so outstanding balances and purchase history remain accurate.
 */
export const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    res.status(404);
    throw new Error("Supplier not found");
  }

  supplier.isActive = false;
  await supplier.save();

  res.status(200).json({
    success: true,
    message: "Supplier deactivated successfully",
    data: { _id: supplier._id, isActive: supplier.isActive },
  });
});