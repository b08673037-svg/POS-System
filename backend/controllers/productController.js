import Product from "../models/Product.js";
import Category from "../models/Category.js";
import asyncHandler from "../middleware/asyncHandler.js";

/**
 * @desc    Create a product
 * @route   POST /api/products
 * @access  Public
 */
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    sku,
    barcode,
    category,
    purchasePrice,
    sellingPrice,
    stockQuantity,
    minStockLevel,
    unit,
    description,
  } = req.body;

  // 1. Category must exist
  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    res.status(400);
    throw new Error("Referenced category does not exist");
  }

  // 2. SKU uniqueness — pre-check for a clean error message.
  //    The schema's unique index handles concurrent races.
  const normalizedSku = sku.toUpperCase().trim();
  const skuTaken = await Product.findOne({ sku: normalizedSku });
  if (skuTaken) {
    res.status(400);
    throw new Error(`SKU "${normalizedSku}" is already in use`);
  }

  // 3. Barcode uniqueness (only if provided)
  if (barcode) {
    const barcodeTaken = await Product.findOne({ barcode: barcode.trim() });
    if (barcodeTaken) {
      res.status(400);
      throw new Error("This barcode is already assigned to another product");
    }
  }

  // 4. Basic sanity checks before DB write
  if (Number(purchasePrice) < 0 || Number(sellingPrice) < 0) {
    res.status(400);
    throw new Error("Prices cannot be negative");
  }
  if (stockQuantity !== undefined && Number(stockQuantity) < 0) {
    res.status(400);
    throw new Error("Stock quantity cannot be negative");
  }

  const product = await Product.create({
    name,
    sku: normalizedSku,
    barcode: barcode ? barcode.trim() : null,
    category,
    purchasePrice,
    sellingPrice,
    stockQuantity: stockQuantity ?? 0,
    minStockLevel: minStockLevel ?? 5,
    unit,
    description,
  });

  // Populate so the client receives the category name, not just its id
  await product.populate("category", "name");

  res.status(201).json({
    success: true,
    message: "Product created successfully",
    data: product,
  });
});

/**
 * @desc    List products (search, category filter, stock-status filter,
 *          sortable, with pagination)
 * @route   GET /api/products
 * @access  Public
 *
 * Query params:
 *   - search         name / SKU / barcode (substring, case-insensitive)
 *   - category       ObjectId
 *   - lowStock       "true"  → only stockQuantity <= minStockLevel (legacy)
 *   - stockStatus    "healthy" | "low" | "out"
 *   - sort           "name" | "stock-asc" | "stock-desc" | "value-desc" | "newest"
 *   - page, limit    pagination
 */
export const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const { search, category, lowStock, stockStatus, sort } = req.query;

  const filter = { isActive: true };
  if (category) filter.category = category;

  if (search && search.trim()) {
    const rx = { $regex: search.trim(), $options: "i" };
    filter.$or = [{ name: rx }, { sku: rx }, { barcode: rx }];
  }

  // Stock-status filter:
  //   "healthy" → stockQuantity > minStockLevel
  //   "low"     → 0 < stockQuantity <= minStockLevel
  //   "out"     → stockQuantity === 0
  // Uses $expr because we compare two fields of the same document.
  if (stockStatus === "healthy") {
    filter.$expr = { $gt: ["$stockQuantity", "$minStockLevel"] };
  } else if (stockStatus === "low") {
    filter.$expr = {
      $and: [
        { $lte: ["$stockQuantity", "$minStockLevel"] },
        { $gt: ["$stockQuantity", 0] },
      ],
    };
  } else if (stockStatus === "out") {
    filter.stockQuantity = 0;
  } else if (lowStock === "true") {
    // Legacy param kept for backwards compatibility
    filter.$expr = { $lte: ["$stockQuantity", "$minStockLevel"] };
  }

  // Sort mapping — anything unrecognised falls back to newest first
  const sortMap = {
    name: { name: 1 },
    "stock-asc": { stockQuantity: 1, name: 1 },
    "stock-desc": { stockQuantity: -1, name: 1 },
    "value-desc": { stockQuantity: -1 }, // refined below via aggregation-free proxy
    newest: { createdAt: -1 },
  };
  const sortStage = sortMap[sort] || { createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name")
      .sort(sortStage)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    data: products,
  });
});

/**
 * @desc    Get one product
 * @route   GET /api/products/:id
 * @access  Public
 */
export const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate(
    "category",
    "name"
  );

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.status(200).json({ success: true, data: product });
});

/**
 * @desc    Convenience endpoint: only low-stock products
 * @route   GET /api/products/low-stock
 * @access  Public
 */
export const getLowStockProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    isActive: true,
    $expr: { $lte: ["$stockQuantity", "$minStockLevel"] },
  })
    .populate("category", "name")
    .sort({ stockQuantity: 1 }); // most urgent first

  res.status(200).json({
    success: true,
    count: products.length,
    data: products,
  });
});

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Public
 *
 * Note: This endpoint intentionally does NOT allow editing stockQuantity.
 * Stock changes flow through sales and purchases only.
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  // If SKU is being changed, check uniqueness
  if (req.body.sku && req.body.sku.toUpperCase().trim() !== product.sku) {
    const normalized = req.body.sku.toUpperCase().trim();
    const taken = await Product.findOne({
      sku: normalized,
      _id: { $ne: product._id },
    });
    if (taken) {
      res.status(400);
      throw new Error(`SKU "${normalized}" is already in use`);
    }
    product.sku = normalized;
  }

  // If barcode is being changed, check uniqueness
  if (req.body.barcode !== undefined) {
    const newBarcode = req.body.barcode ? req.body.barcode.trim() : null;
    if (newBarcode && newBarcode !== product.barcode) {
      const taken = await Product.findOne({
        barcode: newBarcode,
        _id: { $ne: product._id },
      });
      if (taken) {
        res.status(400);
        throw new Error("This barcode is already assigned to another product");
      }
    }
    product.barcode = newBarcode;
  }

  // If category is being changed, verify it exists
  if (req.body.category && req.body.category !== String(product.category)) {
    const categoryExists = await Category.findById(req.body.category);
    if (!categoryExists) {
      res.status(400);
      throw new Error("Referenced category does not exist");
    }
    product.category = req.body.category;
  }

  // Copy allowed scalar fields
  const allowedFields = [
    "name",
    "purchasePrice",
    "sellingPrice",
    "minStockLevel",
    "unit",
    "description",
  ];
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  }

  // NOTE: stockQuantity is deliberately not editable here.
  // It changes through sales (decrease) and purchases (increase).
  // Direct edits would break inventory consistency with historical records.

  const updated = await product.save();
  await updated.populate("category", "name");

  res.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: updated,
  });
});

/**
 * @desc    Delete a product (soft delete)
 * @route   DELETE /api/products/:id
 * @access  Public
 *
 * We soft-delete (set isActive=false) rather than hard-delete, because
 * historical sales and purchases reference this product. Removing the
 * document would leave dangling references. If you later want a true
 * hard-delete for products never sold or purchased, add a check for that.
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  product.isActive = false;
  await product.save();

  res.status(200).json({
    success: true,
    message: "Product deactivated successfully",
    data: { _id: product._id, isActive: product.isActive },
  });
});