const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Order = require("../models/Order");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const getUserByToken = asyncHandler(async (req, res) => {
  if (req.user) {
    return res.status(200).json(req.user);
  }
});
// Backend (Node.js/Express)
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // التحقق من صلاحية المستخدم
  if (req.user._id.toString() !== id) {
    return res
      .status(403)
      .json({ message: "Unauthorized, you can't update user" });
  }

  // استخدام req.body بدلاً من req.query
  const { name, email, phone } = req.body;

  if (!name && !email && !phone) {
    return res.status(400).json({ message: "No data provided to update" });
  }

  const updateFields = {};
  if (name) updateFields.name = name;
  if (email) updateFields.email = email;
  if (phone) updateFields.phone = phone;

  const updatedUser = await User.findByIdAndUpdate(id, updateFields, {
    new: true,
    // إضافة runValidators لتشغيل التحقق من صحة البيانات
    runValidators: true,
  });

  if (!updatedUser) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json(updatedUser);
});
const updateUserAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // استخدام req.body بدلاً من req.query
  const { name, email, phone, password, active, role, addresses } = req.body;

  // إنشاء كائن لتخزين الحقول التي سيتم تحديثها فقط إذا كانت موجودة في req.body
  const updateFields = {};
  if (name) updateFields.name = name;
  if (email) updateFields.email = email;
  if (phone) updateFields.phone = phone;
  if (active !== undefined) updateFields.active = active;
  if (role) updateFields.role = role;
  if (addresses) updateFields.addresses = addresses;
  // تشفير كلمة المرور إذا كانت جديدة
  if (password) {
    const salt = await bcrypt.genSalt(10);
    updateFields.password = await bcrypt.hash(password, salt);
  }

  // تحديث المستخدم
  const updatedUser = await User.findByIdAndUpdate(id, updateFields, {
    new: true,
    runValidators: true,
  });

  if (!updatedUser) {
    return res.json({ status: 404, message: "User not found" });
  }

  res.json({ status: 200, updatedUser });
});
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password,phone, active, addresses, role } = req.body;

  // Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "This email is already in use." });
  }

  // Validate user role
  const allowedRoles = ["user", "admin"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid user role." });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create the new user
  const newUser = await User.create({
    name,
    email,
    password: hashedPassword,
    active,
    phone,
    addresses: addresses || [], // يمكنك تركها فارغة إذا لم يتم تقديمها
    role,
  });

  if (newUser) {
    res.status(201).json({
      status: 201,
      message: "User created successfully.",
      data: {
        _id: newUser._id,
        name: newUser.name,
        phone:newUser.phone || '',
        email: newUser.email,
        active: newUser.active,
        addresses: newUser.addresses || [],
        role: newUser.role,
      },
    });
  } else {
    res.status(400).json({ message: "Invalid user data." });
  }
});


// Function to get user orders
const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 3;

  // التحقق من صحة معرف المستخدم
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    res.status(400);
    throw new Error("Invalid user ID");
  }

  // التحقق من وجود المستخدم
  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  try {
    // حساب إجمالي الطلبات للمستخدم
    const totalOrders = await Order.countDocuments({ user: userId });

    // جلب الطلبات مع الترتيب والتصفح
    const orders = await Order.find({ user: userId })
      .sort({ createdAt: -1 }) // ترتيب من الأحدث إلى الأقدم
      .skip((page - 1) * limit) // تخطي الطلبات السابقة
      .limit(limit); // عرض 3 طلبات فقط

    res.status(200).json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
    });
  } catch (error) {
    res.status(500);
    throw new Error("Error fetching orders: " + error.message);
  }
});
const getUsersStatistics = asyncHandler(async (req, res) => {
  try {
    // تنفيذ جميع الاستعلامات في وقت واحد لتحسين الأداء
    const [totalUsersCount, activeUsersCount, blockedUsersCount] =
      await Promise.all([
        User.countDocuments(), // إجمالي عدد المستخدمين
        User.countDocuments({ active: true }), // عدد المستخدمين النشطين
        User.countDocuments({ active: false }), // عدد المستخدمين المحظورين
      ]);

    res.status(200).json({
      totalUsers: totalUsersCount,
      activeUsers: activeUsersCount,
      blockedUsers: blockedUsersCount,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user statistics", error });
  }
});

// دالة لاسترجاع معلومات المستخدمين مع limit
const getUsers = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search?.trim();
  const status = req.query.status; // استقبال فلترة الحالة من الكلاينت
  const sortBy = req.query.sortBy || "createdAt";
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

  // البحث
  const searchQuery = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { "addresses.addressLine1": { $regex: search, $options: "i" } },
          { "addresses.city": { $regex: search, $options: "i" } },
          { "addresses.country": { $regex: search, $options: "i" } },
          { "addresses.phone": { $regex: search, $options: "i" } },
        ],
      }
    : {};

  // فلترة الحالة بناءً على الفلتر
  const statusQuery =
    status === "active"
      ? { active: true }
      : status === "blocked"
      ? { active: false }
      : {}; // بدون فلتر إذا كانت الحالة "all" أو غير محددة

  const query = {
    ...searchQuery,
    ...statusQuery,
  };

  try {
    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "orders",
          let: { userId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$userId"] } } },
            { $count: "count" },
          ],
          as: "ordersCount",
        },
      },
      {
        $addFields: {
          ordersCount: {
            $ifNull: [{ $arrayElemAt: ["$ordersCount.count", 0] }, 0],
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          ordersCount: 1,
          addresses: 1,
          active: 1,
          createdAt: 1,
        },
      },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const [users, totalCount] = await Promise.all([
      User.aggregate(aggregationPipeline),
      User.countDocuments(query),
    ]);

    res.json({
      totalUsers: totalCount,
      users,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {

    res.status(500).json({
      message: "Error fetching users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});


const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found", status: 404 });
    }

    await user.deleteOne(); // التعديل لاستخدام deleteOne بدلاً من remove
    res.status(200).json({ status: 200, message: "User deleted successfully" });
  } catch (e) {
    res.status(400).json({ status: 400, message: "Error deleting user" });
  }
});

const getUser = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUser = req.user; // نفترض أنك أضفت المستخدم في `req.user` في ميدل وير المصادقة

    
    // التحقق إذا كان المستخدم هو نفس الشخص الذي يطلب معلوماته أو كان أدمن
    if (requestingUser.id === userId || requestingUser.role === "admin") {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json(user); // إرسال بيانات المستخدم
    } else {
      res.status(403).json({ message: "Access denied" }); // المستخدم ليس نفس الشخص وليس أدمن
    }
  } catch (e) {
    res.status(500).json({ message: "An error occurred" });
  }
});

// إضافة الفهارس لتحسين أداء البحث
// يمكن إضافة هذا في ملف نموذج المستخدم (User Model)
/*
userSchema.index({ name: 1 });
userSchema.index({ email: 1 });
userSchema.index({ "addresses.addressLine1": 1 });
userSchema.index({ "addresses.city": 1 });
userSchema.index({ "addresses.country": 1 });
userSchema.index({ "addresses.phone": 1 });
userSchema.index({ active: 1 });
userSchema.index({ createdAt: -1 });
*/

module.exports = {
  getUser,
  getUserOrders,
  getUserByToken,
  getUsersStatistics,
  updateUser,
  getUsers,
  deleteUser,
  updateUserAdmin,
  createUser,
};
