const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  addressLine1: {
    type: String,
    required: true,
  },
  addressLine2: {
    type: String,
    default: "",
  },
  city: {
    type: String,
    required: true,
  },
  country: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  buildingHouseNumber: {
    type: String,
    default: "",
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "user",
    },
    active: {
      type: Boolean,
      default: true,
    },
    password: {
      type: String,
      required: true,
    },
    addresses: [addressSchema], // إضافة حقل العناوين كـ Array من كائنات addressSchema
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);
// إنشاء فهرس على الحقل `active` و `createdAt`
userSchema.index({ active: 1 });  // فهرس تصاعدي على active
userSchema.index({ createdAt: 1 });  // فهرس تصاعدي على createdAt
module.exports = mongoose.model("User", userSchema);
