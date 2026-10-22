import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ Connected: ${mongoose.connection.name}`);

    const email = (process.env.ADMIN_SEED_EMAIL || "").toLowerCase().trim();
    const password = process.env.ADMIN_SEED_PASSWORD || "";
    const name = process.env.ADMIN_SEED_NAME || "Administrator";

    if (!email || !password) {
      console.error(
        "Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env, then run again."
      );
      process.exit(1);
    }
    if (password.length < 8) {
      console.error("Password must be at least 8 characters.");
      process.exit(1);
    }

    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`ℹ️  User ${email} already exists. No change made.`);
      process.exit(0);
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: "admin",
    });

    console.log(`✅ Admin created: ${admin.email} (role: ${admin.role})`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err.message);
    process.exit(1);
  }
};

run();