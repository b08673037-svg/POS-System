import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [80, "Name cannot exceed 80 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      maxlength: [120, "Email cannot exceed 120 characters"],
    },
    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: [30, "Phone cannot exceed 30 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "cashier"],
      default: "cashier",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // --- NEW OTP FIELDS ---
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
      select: false, // Don't send OTP in API responses
    },
    otpExpires: {
      type: Date,
      select: false,
    },
    // ----------------------
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.otp;
  delete obj.otpExpires;
  delete obj.__v;
  return obj;
};

const User = mongoose.model("User", userSchema);
export default User;