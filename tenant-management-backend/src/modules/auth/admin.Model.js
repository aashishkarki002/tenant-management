import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "staff", "super_admin"],
    default: "staff",
  },
  phone: { type: String, required: true },
  address: { type: String, default: "PutaliSadak, Kathmandu" },
  company: { type: String, default: "Sallyan House" },
  profilePicture: { type: String, default: null },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  emailVerificationTokenExpiresAt: { type: Date, default: null },
  // FIX: Store a SHA-256 hash of the refresh token, never the raw JWT.
  // If the DB is compromised, hashed tokens cannot be used directly.
  refreshToken: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  // FIX: Removed the erroneous `timestamps: true` field-level option —
  // that is a schema-level option and was silently ignored here.
  passwordChangedAt: { type: Date, default: null },
});

adminSchema.pre("save", async function () {
  const admin = this;
  if (!admin.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  admin.password = await bcrypt.hash(admin.password, salt);
});

adminSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

export default mongoose.model("Admin", adminSchema);
