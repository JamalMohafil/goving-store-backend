const mongoose = require("mongoose");
const Product = require("./Product");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: String,
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);
reviewSchema.post("save", async function () {
  await updateProductRating(this.productId);
});

// Middleware بعد حذف المراجعة
reviewSchema.post("remove", async function () {
  await updateProductRating(this.productId);
});
async function updateProductRating(productId) {
  const reviews = await mongoose.model("Review").find({ productId });

  // حساب المتوسط مع تحويل التقييم إلى رقم
  const averageRating =
    reviews.reduce((sum, review) => sum + parseFloat(review.rating), 0) /
    reviews.length;

  // تقريب التقييم إلى أقرب نصف
  const roundedRating = roundToNearestHalf(averageRating);

  // تحديث المنتج
  await Product.findByIdAndUpdate(productId, {
    rating: roundedRating.toString() || "0", // التأكد من أن التقييم يتم تخزينه كـ string
  });
}

// دالة لتقريب التقييم إلى أقرب قيمة من القيم المحددة (0, 0.5, 1.0, ...)
function roundToNearestHalf(rating) {
  // القيم المحددة
  const values = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];

  // إيجاد أقرب قيمة
  const closestValue = values.reduce((prev, curr) =>
    Math.abs(curr - rating) < Math.abs(prev - rating) ? curr : prev
  );

  return closestValue;
}

module.exports = mongoose.model("Review", reviewSchema);
