import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [120, "Product name cannot exceed 120 characters"],
    },

    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: [40, "SKU cannot exceed 40 characters"],
    },

    barcode: {
      type: String,
      trim: true,
      default: null,
      // sparse: true → allows multiple docs with barcode: null
      // unique: true → but still forbids duplicate non-null barcodes
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },

    purchasePrice: {
      type: Number,
      required: [true, "Purchase price is required"],
      min: [0, "Purchase price cannot be negative"],
    },

    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
    },

    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock quantity cannot be negative"],
    },

    minStockLevel: {
      type: Number,
      default: 5,
      min: [0, "Minimum stock level cannot be negative"],
    },

    unit: {
      type: String,
      trim: true,
      default: "pcs",
      // e.g. "pcs", "kg", "liter", "box"
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes
productSchema.index({ name: "text" });
productSchema.index({ category: 1 });
// Sparse unique index on barcode — nulls allowed, duplicates forbidden
productSchema.index({ barcode: 1 }, { unique: true, sparse: true });

// Virtual: is this product low on stock?
productSchema.virtual("isLowStock").get(function () {
  return this.stockQuantity <= this.minStockLevel;
});

// Include virtuals when converting to JSON
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

const Product = mongoose.model("Product", productSchema);

export default Product;