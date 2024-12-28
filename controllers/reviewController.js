const asyncHandler = require("express-async-handler");
const Review = require("../models/Review");
const Product = require("../models/Product");
const mongoose = require("mongoose");
const createReview = asyncHandler(async (req, res) => {
  try {
    const { comment, rating, user, productId } = req.body;

    if (!comment || !rating || !user) {
      return res
        .status(400)
        .json({ error: "Please fill all the fields", status: 400 });
    }
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: "Invalid product ID", status: 400 });
    }

    // تأكد من أن المستخدم لا يملك أكثر من مراجعتين للمنتج نفسه
    const existingReviews = await Review.find({
      user: user,
      productId: productId,
    });

    if (existingReviews.length >= 2) {
      return res.status(400).json({
        error: "You can only submit two reviews per product",
        status: 400,
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ error: "Product not found", status: 400 });
    }

    // إنشاء المراجعة في قاعدة البيانات
    const review = await Review.create({ comment, rating, user, productId });
    console.log(review._id, "review");
    // تحديث المنتج ليضيف المراجعة إلى المصفوفة
    product.reviews.push(review._id);
    // حفظ المنتج بعد إضافة المراجعة
    await product.save();
    console.log(product.reviews);

    // التحقق من أن المراجعة تم إنشاؤها بنجاح
    if (!review) {
      return res
        .status(400)
        .json({ error: "Error creating review", status: 400 });
    }

    // إرسال الاستجابة بنجاح
    return res.status(200).json({ review, status: 200 });
  } catch (e) {
    console.error("Error creating review:", e);
    return res
      .status(500)
      .json({ error: e.message || "Internal Server Error", status: 500 });
  }
});

const deleteReview = asyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { productId } = req.query;

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ error: "Invalid review ID", status: 400 });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: "Review not found", status: 404 });
    }

    // التحقق من الصلاحيات
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== review.user.toString()
    ) {
      return res.status(403).json({
        error: "Unauthorized, you can't delete this review",
        status: 403,
      });
    }

    // التحقق من المنتج
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ error: "Product not found", status: 400 });
    }

    // التحقق من ارتباط المراجعة بالمنتج
    if (!product.reviews.includes(reviewId)) {
      return res.status(400).json({
        error: "Review not associated with this product",
        status: 400,
      });
    }

    // حذف المراجعة
    await Review.findByIdAndDelete(reviewId);

    // إزالة المراجعة من قائمة مراجعات المنتج
    product.reviews.pull(reviewId);

    // التحقق من عدد المراجعات المتبقية وتحديث التقييم
    const remainingReviews = await Review.find({ productId: product._id });

    if (remainingReviews.length === 0) {
      product.rating = "0";
    } else {
      // حساب متوسط التقييم الجديد
      const averageRating =
        remainingReviews.reduce(
          (sum, review) => sum + parseFloat(review.rating),
          0
        ) / remainingReviews.length;

      // تقريب التقييم إلى أقرب نصف
      const values = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
      const roundedRating = values.reduce((prev, curr) =>
        Math.abs(curr - averageRating) < Math.abs(prev - averageRating)
          ? curr
          : prev
      );

      product.rating = roundedRating.toString();
    }

    // حفظ التغييرات على المنتج
    await product.save();

    return res.status(200).json({
      message: "Review deleted successfully",
      status: 200,
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: e.message || "Server error", status: 500 });
  }
});

const updateReview = asyncHandler(async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const reviewFind = await Review.findById(reviewId);

    console.log(req.user._id);
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== reviewFind.user.toString()
    ) {
      return res.status(403).json({
        error: "Unauthorized, you can't delete this review",
        status: 403,
      });
    }
    console.log(rating);
    if (
      rating !== "1" &&
      rating !== "2" &&
      rating !== "3" &&
      rating !== "4" &&
      rating !== "5" &&
      rating !== "1.5" &&
      rating !== "2.5" &&
      rating !== "3.5" &&
      rating !== "4.5"
    ) {
      return res.status(400).json({ error: "Invalid rating", status: 400 });
    }

    if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ error: "Invalid review ID", status: 400 });
    }
    const review = await Review.findByIdAndUpdate(
      reviewId,
      { rating, comment },
      { new: true }
    );
    if (!review) {
      return res
        .status(400)
        .json({ error: "Error updating review", status: 400 });
    }
    return res.status(200).json({ review, status: 200 });
  } catch (e) {
    return res.status(500).json({ error: e, status: 500 });
  }
});
const getReviewsByProductId = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 5, sort = "newest" } = req.query;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: "Invalid product ID", status: 400 });
    }

    const product = await Product.findById(productId).populate({
      path: "reviews",
      populate: {
        path: "user",
        select: "name email",
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found", status: 404 });
    }

    const reviews = product.reviews || [];

    // ترتيب المراجعات
    const sortedReviews = reviews.sort((a, b) => {
      return sort === "newest"
        ? new Date(b.createdAt) - new Date(a.createdAt) // من الأحدث للأقدم
        : new Date(a.createdAt) - new Date(b.createdAt); // من الأقدم للأحدث
    });

    // تطبيق الصفحات
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const startIndex = (pageNumber - 1) * limitNumber;
    const endIndex = pageNumber * limitNumber;

    const paginatedReviews = sortedReviews.slice(startIndex, endIndex);

    const formattedReviews = paginatedReviews.map((review) => {
      const reviewObject = review.toObject();
      return {
        ...reviewObject,
        user: reviewObject.user
          ? {
              id: reviewObject.user._id,
              name: reviewObject.user.name,
              email: reviewObject.user.email,
            }
          : null,
      };
    });

    return res.status(200).json({
      reviews: formattedReviews,
      totalReviews: reviews.length,
      currentPage: pageNumber,
      totalPages: Math.ceil(reviews.length / limitNumber),
      status: 200,
    });
  } catch (e) {
    console.error("Error in getReviewsByProductId:", e);
    return res.status(500).json({
      error: "Internal server error",
      details: e.message,
      status: 500,
    });
  }
});

module.exports = {
  createReview,
  getReviewsByProductId,
  deleteReview,
  updateReview,
};
