import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
      unique: true,
      maxlength: [120, "Supplier name cannot exceed 120 characters"],
    },

    contactPerson: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Contact person cannot exceed 100 characters"],
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: [30, "Phone cannot exceed 30 characters"],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: [100, "Email cannot exceed 100 characters"],
    },

    address: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "Address cannot exceed 300 characters"],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

supplierSchema.index({ name: "text", phone: "text", email: "text" });

const Supplier = mongoose.model("Supplier", supplierSchema);

export default Supplier;