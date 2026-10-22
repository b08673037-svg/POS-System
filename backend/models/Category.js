import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
      maxlength: [60, "Category name cannot exceed 60 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, "Description cannot exceed 300 characters"],
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Text index for search
categorySchema.index({ name: "text" });

const Category = mongoose.model("Category", categorySchema);

export default Category;