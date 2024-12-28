const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    discountPercent: {
      type: String,
      required: true,
    },
    expiryDate: {
      type: Date, // تغيير النوع إلى Date ليسهل التعامل مع التواريخ
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    active: {
      type: Boolean,
      default: function () {
        // يقارن تاريخ اليوم الحالي بتاريخ الانتهاء
        return new Date() <= this.expiryDate;
      },
    },
  },
  { timestamps: true }
);

// إضافة ميدل وير يقوم بتحديث حالة الـ active تلقائياً قبل الحفظ
couponSchema.pre("save", function (next) {
  this.active = new Date() <= this.expiryDate;
  next();
});

module.exports = mongoose.model("Coupon", couponSchema);
