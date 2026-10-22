import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
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

customerSchema.index({ fullName: "text", phone: "text", email: "text" });

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;