const asyncHandler = require("express-async-handler");
const Coupon = require("../models/Coupon");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");

const getCoupons = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search?.trim();
  const filter = req.query.filter;

  const searchQuery = search
    ? { $or: [{ name: { $regex: search, $options: "i" } }] }
    : {};

  let filterQuery = {};
  if (filter && filter !== "all") {
    const realFilter = filter === "true" ? true : false;
    filterQuery = { active: realFilter };
  }

  const query = {
    ...searchQuery,
    ...filterQuery,
  };
  try {
    const aggregationPipeline = [
      { $match: query },
      // Lookup to join with Users collection
      {
        $lookup: {
          from: "users", // Make sure this matches your users collection name
          localField: "createdBy",
          foreignField: "_id",
          as: "creatorDetails",
        },
      },
      // Unwind the creatorDetails array
      {
        $unwind: {
          path: "$creatorDetails",
          preserveNullAndEmptyArrays: true, // Keep coupons even if no creator found
        },
      },
      // Project to reshape the output
      {
        $project: {
          name: 1,
          discountPercent: 1,
          expiryDate: 1,
          active: 1,
          createdBy: {
            _id: "$creatorDetails._id",
            name: "$creatorDetails.name", // Adjust based on your user model
          },
        },
      },
      { $skip: (page - 1) * limit }, // تخطي العناصر أولاً
      { $limit: limit }, // ثم تحديد العدد المطلوب
    ];

    const [coupons, totalCount] = await Promise.all([
      Coupon.aggregate(aggregationPipeline),
      Coupon.countDocuments(query),
    ]);

    res.json({
      totalCoupons: totalCount,
      coupons: coupons,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (e) {
    return res.status(404).json({ message: e.message });
  }
});
const getCouponsStatistics = asyncHandler(async (req, res) => {
  try {
    const couponsCount = await Coupon.countDocuments();

    return res
      .status(200)
      .json({ status: 200, STATS: { totalCoupons: couponsCount } });
  } catch (e) {
    return res.status(404).json({ message: e.message });
  }
});

const createCoupon = asyncHandler(async (req, res) => {
  try {
    const { name, expiryDate, discountPercent, createdBy } = req.body;
    console.log(name, expiryDate, discountPercent, createdBy);

    // التحقق من البيانات المطلوبة
    if (!name || !expiryDate || !discountPercent || !createdBy) {
      return res
        .status(400)
        .json({ status: 400, message: "Please fill in all required fields." });
    }

    // معالجة تحويل الفاصلة إلى نقطة
    let normalizedDiscountPercent = discountPercent;
    if (typeof discountPercent === "string") {
      // إذا كانت الفاصلة موجودة، حولها إلى نقطة
      if (discountPercent.includes(",")) {
        normalizedDiscountPercent = discountPercent.replace(",", ".");
      }
    }

    // التحقق من صلاحية البيانات
    const newDisc = parseFloat(normalizedDiscountPercent);
    if (isNaN(newDisc) || newDisc <= 0 || newDisc > 100) {
      return res.status(400).json({
        status: 400,
        message: "Discount percent must be between 1 and 100.",
      });
    }

    if (new Date(expiryDate) <= new Date()) {
      return res
        .status(400)
        .json({ status: 400, message: "Expiry date must be in the future." });
    }

    // إنشاء الكوبون
    const newCoupon = await Coupon.create({
      name,
      createdBy,
      discountPercent: newDisc, // استخدام القيمة المحولة
      expiryDate,
    });

    // الرد مع البيانات المُنشأة
    return res.status(201).json({ status: 201, coupon: newCoupon });
  } catch (error) {
    console.error("Error creating coupon:", error);
    return res.status(500).json({
      status: 500,
      message: "An error occurred while creating the coupon.",
      error: error.message,
    });
  }
});

const updateCoupon = asyncHandler(async (req, res) => {
  try {
    const { name, expiryDate, discountPercent } = req.body;
    const couponId = req.params.id;

    // التحقق من وجود الـ ID وصلاحيته
    if (!couponId || !mongoose.Types.ObjectId.isValid(couponId)) {
      return res
        .status(400)
        .json({ status: 400, message: "Invalid coupon ID." });
    }

    // التحقق من البيانات المطلوبة
    if (!name || !expiryDate || !discountPercent) {
      return res
        .status(400)
        .json({ status: 400, message: "Please fill in all required fields." });
    }
    let normalizedDiscountPercent = discountPercent;
    if (typeof discountPercent === "string") {
      // إذا كانت الفاصلة موجودة، حولها إلى نقطة
      if (discountPercent.includes(",")) {
        normalizedDiscountPercent = discountPercent.replace(",", ".");
      }
    }

    // التحقق من صلاحية البيانات
    const newDisc = parseFloat(normalizedDiscountPercent);
    if (isNaN(newDisc) || newDisc <= 0 || newDisc > 100) {
      return res.status(400).json({
        status: 400,
        message: "Discount percent must be between 1 and 100.",
      });
    }
    if (
      isNaN(new Date(expiryDate).getTime()) ||
      new Date(expiryDate) <= new Date()
    ) {
      return res.status(400).json({
        status: 400,
        message: "Expiry date must be a valid future date.",
      });
    }

    // تحديث الكوبون
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { name, discountPercent: newDisc, expiryDate },
      { new: true } // إرجاع النسخة المحدثة
    );

    if (!updatedCoupon) {
      return res.status(404).json({
        status: 404,
        message: "Coupon not found or could not be updated.",
      });
    }

    // الرد بالبيانات المحدثة
    return res.status(200).json({ status: 200, coupon: updatedCoupon });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return res.status(500).json({
      status: 500,
      message: "An error occurred while updating the coupon.",
      error: error.message,
    });
  }
});

const deleteCoupon = asyncHandler(async (req, res) => {
  try {
    const couponId = req.params.id;

    if (!couponId || !mongoose.Types.ObjectId.isValid(couponId)) {
      return res.json({ status: 400, message: "Invalid coupon ID." });
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
    if (!deletedCoupon) {
      return res.json({
        status: 400,
        message: "Coupon not found, please try again later",
      });
    }

    return res.status(200).json({ status: 200, deletedCoupon });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e });
  }
});

const applyCoupon = asyncHandler(async (req, res) => {
  try {
    const { code, cartId } = req.body;

    // Input validation
    if (!code || !cartId || !mongoose.Types.ObjectId.isValid(cartId)) {
      return res.status(400).json({
        status: 400,
        error: "Please provide a valid coupon code and cart ID.",
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({ name: code });
    if (!coupon) {
      return res.status(400).json({
        status: 400,
        error: "Invalid coupon code. Please check and try again.",
      });
    }

    // Check coupon status
    if (!coupon.active) {
      return res.status(400).json({
        status: 400,
        error: "This coupon is currently inactive.",
      });
    }

    // Check expiration date
    if (new Date(coupon.expiryDate) <= new Date()) {
      return res.status(400).json({
        status: 400,
        error: "This coupon has expired.",
      });
    }

    // Find cart and load details
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.status(400).json({
        status: 400,
        error: "Cart not found. Please check the cart ID.",
      });
    }

    // Calculate final price with discount
    // 1. Calculate subtotal (sum of all product prices)
    const subtotal = cart.items.reduce(
      (sum, item) => sum + parseFloat(item.totalPrice),
      0
    );
    cart.subTotal = subtotal.toFixed(2);

    // 2. Calculate tax
    const TAX_RATE = 0.05;
    const taxPrice = subtotal * TAX_RATE;
    cart.taxPrice = taxPrice.toFixed(2);

    // 3. Calculate amount after tax
    const subtotalWithTax = subtotal + taxPrice;

    // 4. Apply discount
    cart.discount = coupon.discountPercent;
    const discountAmount = subtotalWithTax * (coupon.discountPercent / 100);

    // 5. Calculate final total
    const finalTotal = subtotalWithTax - discountAmount;
    cart.total = finalTotal.toFixed(2);

    // Save coupon information to cart
    cart.appliedCoupon = {
      code: coupon.name,
      discountPercent: coupon.discountPercent,
    };

    await cart.save();

    return res.status(200).json({
      status: 200,
      message: "Coupon applied successfully",
      cart: {
        ...cart.toObject(),
        calculationBreakdown: {
          subtotal: cart.subTotal,
          taxPrice: cart.taxPrice,
          discountPercent: coupon.discountPercent,
          discountAmount: discountAmount.toFixed(2),
          finalTotal: cart.total,
        },
      },
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    return res.status(500).json({
      status: 500,
      error:
        "An error occurred while applying the coupon. Please try again later.",
    });
  }
});

module.exports = {
  getCoupons,
  createCoupon,
  updateCoupon,
  getCouponsStatistics,
  deleteCoupon,
  applyCoupon,
};
