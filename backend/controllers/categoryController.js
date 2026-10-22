import Category from "../models/Category.js";
import Product from "../models/Product.js";
import asyncHandler from "../middleware/asyncHandler.js";

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Public (auth added later)
 */
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // Friendly pre-check. The DB's unique index also enforces this
  // (which handles the race-condition case gracefully via errorMiddleware).
  const exists = await Category.findOne({ name: name.trim() });
  if (exists) {
    res.status(400);
    throw new Error("A category with this name already exists");
  }

  const category = await Category.create({ name, description });

  res.status(201).json({
    success: true,
    message: "Category created successfully",
    data: category,
  });
});

/**
 * @desc    List categories (search + pagination)
 * @route   GET /api/categories
 * @access  Public
 */
export const getCategories = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  const search = req.query.search ? req.query.search.trim() : "";

  const filter = { isActive: true };
  if (search) {
    // Case-insensitive substring match on the name field
    filter.name = { $regex: search, $options: "i" };
  }

  // Run both queries in parallel — faster than sequential
  const [categories, total] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Category.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: categories.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: categories,
  });
});

/**
 * @desc    Get a single category
 * @route   GET /api/categories/:id
 * @access  Public
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  res.status(200).json({ success: true, data: category });
});

/**
 * @desc    Update a category
 * @route   PUT /api/categories/:id
 * @access  Public
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // If the name is being changed, make sure it does not collide with another category
  if (req.body.name && req.body.name.trim() !== category.name) {
    const duplicate = await Category.findOne({
      name: req.body.name.trim(),
      _id: { $ne: category._id },
    });
    if (duplicate) {
      res.status(400);
      throw new Error("Another category already uses this name");
    }
    category.name = req.body.name.trim();
  }

  if (req.body.description !== undefined) {
    category.description = req.body.description;
  }

  const updated = await category.save();

  res.status(200).json({
    success: true,
    message: "Category updated successfully",
    data: updated,
  });
});

/**
 * @desc    Delete a category
 * @route   DELETE /api/categories/:id
 * @access  Public
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  // SAFETY: refuse to delete if any active product still uses this category
  const productCount = await Product.countDocuments({
    category: category._id,
    isActive: true,
  });

  if (productCount > 0) {
    res.status(400);
    throw new Error(
      `Cannot delete this category — ${productCount} active product(s) still reference it. Reassign or delete those products first.`
    );
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
    data: { _id: category._id },
  });
});