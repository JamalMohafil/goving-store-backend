const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const Cart = require("../models/Cart");

const ORDER_STATUS = {
  COMPLETED: "Completed",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
  RESTITUTE: "Resitute",
};

const getOrdersStatistics = asyncHandler(async (req, res) => {
  try {
    // استخدام Promise.all للحصول على جميع الإحصائيات بشكل متوازي
    const [totalOrders, stats] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // التأكد من تضمين جميع الحالات الممكنة حتى لو كانت غير موجودة
    const statisticsMap = Object.values(ORDER_STATUS).reduce((acc, status) => {
      const foundStat = stats.find((stat) => stat._id === status);
      acc[status.toLowerCase() + "Orders"] = foundStat ? foundStat.count : 0;
      return acc;
    }, {});

    return res.status(200).json({
      status: 200,
      STATS: {
        totalOrders,
        ...statisticsMap,
      },
    });
  } catch (error) {
    console.error("Error fetching order statistics:", error);
    return res.status(500).json({
      status: 500,
      error: {
        message: "حدث خطأ أثناء جلب إحصائيات الطلبات",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    });
  }
});
const getOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 6;
  const search = req.query.search?.trim();
  const filter = req.query.filter;

  let filterQuery = {};
  if (filter && filter !== "all") {
    filterQuery = { status: filter };
  }

  try {
    const aggregationPipeline = [
      { $match: filterQuery }, // تطبيق الفلتر على الطلبات
      {
        $lookup: {
          from: "users", // اسم مجموعة المستخدمين
          localField: "user",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" }, // لضمان أن البيانات تظهر ككائن وليس مصفوفة
      {
        $match: search
          ? {
              $or: [
                { orderNumber: { $regex: search, $options: "i" } },
                { "customer.name": { $regex: search, $options: "i" } },
              ],
            }
          : {}, // تطبيق البحث
      },
      {
        $project: {
          // تحديد الحقول المطلوبة فقط
          orderId: "$_id",
          orderNumber: "$orderNumber",
          customerName: "$customer.name", // يفترض أن الحقل `name` موجود في schema المستخدم
          orderDeliveryDate: "$createdAt", // أو أي منطق آخر لتحديد تاريخ التسليم
          total: 1,
          deliveryStatus: "$status",
          payment: "$paymentStatus",
        },
      },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const [orders, totalCount] = await Promise.all([
      Order.aggregate(aggregationPipeline),
      Order.countDocuments(filterQuery),
    ]);

    res.json({
      totalOrders: totalCount,
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message, status: 500 });
  }
});

const getOrderInformation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }

    if (
      order.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(401).json({ error: "Unauthorized", status: 401 });
    }
    res.status(200).json({ order, status: 200 });
  } catch (e) {
    res.status(500).json({ error: "Try again later", status: 500 });
  }
});
const getAdminOrderInformation = asyncHandler(async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(401).json({ error: "Unauthorized", status: 401 });
    }
    const { id } = req.params;
    const order = await Order.findById(id).populate("user");
    if (!order) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }

    res.status(200).json({ order, status: 200 });
  } catch (e) {
    return res.status(500).json({ error: e.message, status: 500 });
  }
});
const createOrder = asyncHandler(async (req, res) => {
  const {
    userId,
    paymentDetails,
    appliedCoupon,
    subTotal,
    discountPercent,
    vat,
    total,
    paymentMethod,
  } = req.body;

  // التحقق من صحة البيانات الواردة
  if (!userId || !paymentDetails || !subTotal || !total) {
    return res
      .status(400)
      .json({ error: "All fields are required.", status: 400 });
  }
  if (userId !== req.user._id.toString() && req.user.role !== "admin") {
    return res.status(401).json({ error: "Unauthorized", status: 401 });
  }
  // حساب المجموع الكلي من القيم المدخلة
  const userCart = await Cart.findOne({ user: userId });

  if (!userCart) {
    return res.status(404).json({ error: "Cart not found", status: 404 });
  }

  try {
    const ordersCount = await Order.countDocuments({});
    // إنشاء طلب جديد
    const newOrder = new Order({
      user: userId,
      items: userCart.items,
      paymentDetails: {
        cardNumber: paymentDetails.cardNumber,
        cardHolderName: paymentDetails.cardHolderName,
        expirationDate: paymentDetails.expirationDate,
        cvv: paymentDetails.cvv,
      },
      paymentMethod: paymentMethod,
      subTotal: Number(total).toFixed(2).toString(),
      total: Number(total).toFixed(2).toString(), // القيمة الكلية المرسلة من الواجهة الأمامية
      discount: discountPercent,
      taxPrice: Number(vat).toFixed(2).toString(),
      orderNumber: `DOZ${ordersCount + 1}`,
      appliedCoupon: appliedCoupon || null, // إذا كان هناك كود خصم
      status: "Pending",
    });
    await Cart.deleteOne({ user: userId });
    // حفظ الطلب في قاعدة البيانات
    await newOrder.save();

    // إرسال استجابة للمستخدم
    res.status(201).json({
      message: "Order created successfully",
      order: newOrder,
      status: 201,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to create order", details: error.message });
  }
});
const getOrderThanks = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }
    if (
      order.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(401)
        .json({ error: "A problem occured, try again later", status: 401 });
    }
    res.status(200).json({ order, status: 200 });
  } catch (e) {
    res.status(500).json({ error: "Try again later", status: 500 });
  }
});
const updateOrderStatus = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // التأكد من أن الـ status مبدئيًا ليس فارغًا
    if (!status) {
      return res.status(400).json({ error: "Status is required", status: 400 });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }

    // التأكد من أن المستخدم هو مسؤول
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Unauthorized: Admin role required",
        status: 403,
      });
    }

    // تحديث حالة الطلب
    order.status = status;
    await order.save();

    res.status(200).json({
      message: "Order status updated successfully",
      order,
      status: 200,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: "An error occurred, please try again later",
      status: 500,
    });
  }
});
const deleteOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
    if (!order) {
      return res.status(404).json({ error: "Order not found", status: 404 });
    }
    if(req.user.role !== "admin"){
      return res.status(401).json({ error: "Unauthorized", status: 401 });
    }
    res.status(200).json({ message: "Order deleted successfully", status: 200 });
  } catch (e) {
    res.status(500).json({ error: "Try again later", status: 500 });
  }
});
module.exports = {
  getOrdersStatistics,
  getOrders,
  createOrder,
  getOrderThanks,
  getOrderInformation,
  getAdminOrderInformation,
  updateOrderStatus,deleteOrder,
  ORDER_STATUS, // تصدير الثوابت للاستخدام في أماكن أخرى
};
