const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");
const SubCategory = require("../models/SubCategory");
const Product = require("../models/Product");
const path = require("path");
const sharp = require("sharp");
const Order = require("../models/Order");
const User = require("../models/User");
const fs = require("fs").promises;
const getProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 6;
  const search = req.query.search?.trim();
  const filter = req.query.filter;

  let searchQuery = search
    ? {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      }
    : {};
  let filterQuery = {};
  if (filter && filter !== "all") {
    filterQuery = { category: new mongoose.Types.ObjectId(filter) }; // تأكد من أن `filter` هو ObjectId
  }
  const query = {
    ...searchQuery,
    ...filterQuery,
  };
  try {
    const aggregationPipeline = [
      { $match: query },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $addFields: {
          categoryDetails: { $arrayElemAt: ["$categoryDetails", 0] }, // استخراج أول عنصر من المصفوفة
        },
      },
      {
        $project: {
          name: 1,
          price: 1,
          beforePrice: 1,
          category: {
            id: "$categoryDetails._id",
            name: "$categoryDetails.name",
          },
          image: 1,
          devices: 1,
        },
      },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];
    const [products, totalCount] = await Promise.all([
      Product.aggregate(aggregationPipeline),
      Product.countDocuments(query),
    ]);
    return res.status(200).json({ status: 200, products, totalCount });
  } catch (e) {
    console.error("Error fetching products:", e);
    return res.status(500).json({ error: e.message || e, status: 500 });
  }
});

const getProduct = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // التحقق من صحة الـ ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid product ID", status: 400 });
    }

    // البحث عن المنتج واستخدام populate لاستدعاء البيانات المطلوبة للـ category و subCategories
    const product = await Product.findById(id)
      .populate({
        path: "category", // استدعاء البيانات الخاصة بالـ category
        select: "_id name", // تحديد الحقول المطلوبة فقط
      })
      .populate({
        path: "subCategories", // استدعاء البيانات الخاصة بالـ subCategories
        select: "_id name category", // تحديد الحقول المطلوبة فقط
      });

    // التحقق إذا كان المنتج موجودًا
    if (!product) {
      return res.status(404).json({ error: "Product not found", status: 404 });
    }

    // إرجاع المنتج بعد استدعاء البيانات المطلوبة
    return res.status(200).json({ status: 200, product });
  } catch (e) {
    // التعامل مع الأخطاء
    return res.status(500).json({ error: e.message, status: 500 });
  }
});

const getProductsStatistics = asyncHandler(async (req, res) => {
  try {
    // إجمالي عدد المنتجات
    const totalProducts = await Product.countDocuments();

    // إجمالي عدد المنتجات في التصنيفات
    const totalProductInCategories = await Product.countDocuments({
      category: { $exists: true, $ne: null }, // تأكد من أن `category` ليس فارغًا أو null
    });

    // حساب متوسط المنتجات لكل تصنيف
    const avgProductsPerCategoryResult = await Product.aggregate([
      {
        $match: { category: { $exists: true, $ne: null } }, // تأكد من أن `category` ليس null
      },
      {
        $group: {
          _id: "$category",
          productCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          avgProductsPerCategory: { $avg: "$productCount" },
        },
      },
    ]);

    // استخراج قيمة المتوسط إذا كانت النتيجة موجودة، وإلا تعيين 0
    const avgProductsPerCategory =
      avgProductsPerCategoryResult.length > 0
        ? avgProductsPerCategoryResult[0]?.avgProductsPerCategory
        : 0;

    return res.status(200).json({
      status: 200,
      STATS: {
        totalProducts,
        totalProductInCategories,
        avgProductsPerCategory,
      },
    });
  } catch (e) {
    console.error("Error fetching product statistics:", e);
    return res.status(500).json({ status: 500, error: e.message });
  }
});
const getCategoriesForProducts = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find().select("_id name");
    return res.status(200).json({ status: 200, categories });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e });
  }
});
const getSubCategoriesForProducts = asyncHandler(async (req, res) => {
  try {
    const subCategories = await SubCategory.find().select("_id category name");
    return res.status(200).json({ status: 200, subCategories });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e });
  }
});
const createProduct = asyncHandler(async (req, res) => {
  try {
    let bannerPath = "";
    let imagePath = "";

    // التحقق مما إذا كانت الملفات مرفقة
    if (req.files?.banner?.[0]) {
      const bannerFile = req.files.banner[0];
      const bannerFileName = `banner-${Date.now()}-${path.basename(
        bannerFile.originalname
      )}`;
      const bannerOutputPath = path.join("uploads", bannerFileName);

      // معالجة ملف البانر باستخدام Sharp
      try {
        await sharp(bannerFile.path)
          .jpeg({ quality: 80 })
          .toFile(bannerOutputPath);

        // حذف الملف الأصلي
        try {
          await fs.promises.unlink(bannerFile.path);
        } catch (unlinkError) {
          console.error("Error deleting banner file:", unlinkError);
        }

        bannerPath = `/uploads/${bannerFileName}`;
      } catch (err) {
        console.error(`Error processing banner file:`, err);
        throw new Error("Failed to process banner image");
      }
    }

    if (req.files?.image?.[0]) {
      const imageFile = req.files.image[0];
      const imageFileName = `image-${Date.now()}-${path.basename(
        imageFile.originalname
      )}`;
      const imageOutputPath = path.join("uploads", imageFileName);

      try {
        await sharp(imageFile.path)
          .jpeg({ quality: 80 })
          .toFile(imageOutputPath);

        // حذف الملف الأصلي
        try {
          await fs.promises.unlink(imageFile.path);
        } catch (unlinkError) {
          console.error("Error deleting image file:", unlinkError);
        }

        imagePath = `/uploads/${imageFileName}`;
      } catch (err) {
        console.error(`Error processing image file:`, err);
        throw new Error("Failed to process product image");
      }
    }

    // استخراج البيانات من الـ FormData
    const {
      name,
      description,
      price,
      quantity,
      beforePrice,
      note,
      category,
      subCategories,
      devices,
      inputs,
      props,
    } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        status: 400,
        message: "Name and Price are required",
      });
    }

    if (!props && !quantity) {
      return res
        .status(400)
        .json({ status: 400, message: "You should add props or quantity" });
    }

    if (!imagePath || !bannerPath) {
      return res
        .status(400)
        .json({ status: 400, message: "Banner and Image are required" });
    }

    // حساب الكمية
    let finalQuantity = quantity ? parseInt(quantity) : 0;
    let parsedProps = null;

    if (props) {
      parsedProps = JSON.parse(props);

      // التأكد من أن props له قيمة وليس فارغًا
      const isEmptyProps =
        !parsedProps ||
        !parsedProps.details ||
        parsedProps.details.length === 0 ||
        parsedProps.details.every(
          (detail) =>
            detail.title === "" && detail.price === 0 && detail.quantity === 0
        );

      if (isEmptyProps) {
        parsedProps = [];
      }
    }
    // معالجة الـ inputs
    let parsedInputs = [];
    if (inputs) {
      try {
        // إذا كان inputs string (من FormData)
        if (typeof inputs === "string") {
          parsedInputs = JSON.parse(inputs);
        }
        // إذا كان inputs مصفوفة
        else if (Array.isArray(inputs)) {
          parsedInputs = inputs;
        }

        // تصفية الـ inputs
        parsedInputs = parsedInputs.filter(
          (input) =>
            input &&
            typeof input === "object" &&
            input.name &&
            input.description
        );
      } catch (error) {
        console.error("Error parsing inputs:", error);
        parsedInputs = [];
      }
    }

    // إنشاء المنتج الجديد
    const newProduct = new Product({
      name,
      description: description || "",
      banner: bannerPath,
      image: imagePath,
      price: parseFloat(price),
      quantity: finalQuantity,
      beforePrice: beforePrice ? parseFloat(beforePrice) : null,
      note: note || "",
      category: category || null,
      subCategories: subCategories ? JSON.parse(subCategories) : [],
      devices: devices ? JSON.parse(devices) : [],
      inputs: parsedInputs,
      props: parsedProps || [], // استخدم مصفوفة فارغة إذا كان props فارغًا
    });

    // حفظ المنتج في قاعدة البيانات
    const savedProduct = await newProduct.save();

    return res.status(201).json({
      message: "Product created successfully",
      product: savedProduct,
    });
  } catch (e) {
    console.error("Error creating product:", e);
    return res.status(500).json({
      error: e.message || "Error creating product",
      status: 500,
    });
  }
});
const updateProduct = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // الحصول على الـ id من الـ URL
    let bannerPath = "";
    let imagePath = "";

    // البحث عن المنتج في قاعدة البيانات
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // التحقق مما إذا كانت الملفات مرفقة
    if (req.files?.banner) {
      const bannerFile = req.files.banner[0];
      const bannerFileName = `banner-${Date.now()}-${path.basename(
        bannerFile.originalname
      )}`;
      const bannerOutputPath = path.join("uploads", bannerFileName);

      // معالجة ملف البانر باستخدام Sharp
      await sharp(bannerFile.path)
        .jpeg({ quality: 80 })
        .toFile(bannerOutputPath);

      // حذف الملف الأصلي بطريقة آمنة
      try {
        await fs.promises.unlink(bannerFile.path);
      } catch (err) {
        console.error(`Failed to delete banner file: ${bannerFile.path}`, err);
      }

      bannerPath = `/uploads/${bannerFileName}`;
      existingProduct.banner = bannerPath; // تحديث مسار البانر
    }

    if (req.files?.image) {
      const imageFile = req.files.image[0];
      const imageFileName = `image-${Date.now()}-${path.basename(
        imageFile.originalname
      )}`;
      const imageOutputPath = path.join("uploads", imageFileName);

      // معالجة ملف الصورة باستخدام Sharp
      await sharp(imageFile.path).jpeg({ quality: 80 }).toFile(imageOutputPath);

      // حذف الملف الأصلي بطريقة آمنة
      try {
        await fs.promises.unlink(imageFile.path);
      } catch (err) {
        console.error(`Failed to delete image file: ${imageFile.path}`, err);
      }

      imagePath = `/uploads/${imageFileName}`;
      existingProduct.image = imagePath; // تحديث مسار الصورة
    }

    // استخراج البيانات من الـ FormData
    const {
      name,
      description,
      price,
      quantity,
      beforePrice,
      note,
      category,
      subCategories,
      devices,
      inputs,
      props,
    } = req.body;

    // التحقق من الحقول المطلوبة
    if (!name || !price) {
      return res.status(400).json({
        status: 400,
        message: "Name and Quantity and Price are required",
      });
    }

    if (!props && !quantity) {
      return res
        .status(400)
        .json({ status: 400, message: "You should add props or quantity" });
    }

    // حساب الكمية
    let finalQuantity = quantity; // القيمة الافتراضية
    const parsedProps = props ? JSON.parse(props) : null;

    if (parsedProps?.details?.length) {
      finalQuantity = parsedProps.details.reduce((total, item) => {
        return total + (item.quantity || 0); // إجمالي الكميات
      }, 0);
    }
    // تحديث البيانات
    existingProduct.name = name;
    existingProduct.description = description || "";
    existingProduct.price = price;
    existingProduct.quantity = finalQuantity;
    existingProduct.beforePrice = beforePrice || null;
    existingProduct.note = note || "";
    existingProduct.category = category || null;
    existingProduct.subCategories = subCategories
      ? JSON.parse(subCategories)
      : [];
    existingProduct.devices = devices ? JSON.parse(devices) : [];
    // التحقق من المدخلات (inputs)
    let parsedInputs = [];
    if (inputs) {
      // إذا كانت inputs نصًا، نحاول تحويله إلى مصفوفة
      if (typeof inputs === "string") {
        try {
          parsedInputs = JSON.parse(inputs);
        } catch (error) {
          return res
            .status(400)
            .json({ message: "Invalid inputs format", status: 400 });
        }
      } else if (Array.isArray(inputs)) {
        parsedInputs = inputs;
      }

      // تصفية العناصر التي لا تحتوي على اسم أو وصف
      parsedInputs = parsedInputs.filter(
        (item) => item.name && item.description
      );
    }

    existingProduct.inputs = parsedInputs;
    existingProduct.props = parsedProps;

    // حفظ التحديثات في قاعدة البيانات
    const updatedProduct = await existingProduct.save();

    return res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (e) {
    console.error("Error updating product:", e);
    return res.status(500).json({ error: e.message, status: 500 });
  }
});

const deleteProduct = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Id not valid" });
    }
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res
        .status(400)
        .json({ message: "Product Not Found", status: 400 });
    }

    return res.status(200).json({ status: 200, deletedProduct });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e });
  }
});

const mainDashboardStatistics = asyncHandler(async (req, res) => {
  try {
    // تنفيذ الاستعلامات بالتوازي باستخدام Promise.all
    const [
      totalProducts,
      totalCategories,
      totalSales,
      completedOrders,
      pendingOrders,
      activeCustomers,
      newCustomers,
      averageOrderValueData,
    ] = await Promise.all([
      Product.countDocuments() || 0, // إجمالي عدد المنتجات
      Category.countDocuments() || 0, // إجمالي عدد الفئات
      Order.aggregate([
        // إجمالي المبيعات
        { $match: { status: "Completed" } },
        {
          $project: {
            total: { $toDouble: "$total" }, // تحويل total من String إلى Number
          },
        },
        { $group: { _id: null, totalSales: { $sum: "$total" } } },
      ]),
      Order.countDocuments({ status: "Completed" }) || 0, // عدد الطلبات المكتملة
      Order.countDocuments({ status: "Pending" }) || 0, // عدد الطلبات المعلقة
      User.countDocuments({ active: true }) || 0, // عدد العملاء النشطين
      User.countDocuments({
        // عدد العملاء الجدد
        createdAt: {
          $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        },
      }) || 0,
      Order.aggregate([
        // متوسط قيمة الطلب
        { $match: { status: "Completed" } },
        {
          $project: {
            total: { $toDouble: "$total" }, // تحويل total من String إلى Number
          },
        },
        { $group: { _id: null, averageOrderValue: { $avg: "$total" } } },
      ]),
    ]);

    // حساب المتوسطات والنتائج المطلوبة
    const averageProductsPerCategory =
      totalCategories > 0
        ? (totalProducts / totalCategories).toFixed(2)
        : "0.00";

    const totalSalesAmount = totalSales[0] ? totalSales[0].totalSales : 0;

    const averageOrderValue = averageOrderValueData[0]
      ? (averageOrderValueData[0].averageOrderValue || 0).toFixed(2) // استخدام القيمة الافتراضية إذا كانت null أو undefined
      : "0.00";

    // إرسال البيانات
    return res.status(200).json({
      totalProducts,
      totalCategories,
      averageProductsPerCategory,
      totalSales: totalSalesAmount,
      completedOrders,
      pendingOrders,
      activeCustomers,
      newCustomers,
      averageOrderValue,
    });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e.message });
  }
});


const getProductsByCategoryHome = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ status: 400, message: "Id not valid" });
    }
    const products = await Product.find({ category: id })
      .select("_id price beforePrice devices image name note props")
      .limit(5);
    return res.status(200).json({ status: 200, products });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e });
  }
});

const lastProducts = asyncHandler(async (req, res) => {
  const limit = 4; // تحديد العدد الثابت للمنتجات

  try {
    const aggregationPipeline = [
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      {
        $addFields: {
          categoryDetails: { $arrayElemAt: ["$categoryDetails", 0] }, // استخراج أول عنصر من المصفوفة
        },
      },
      {
        $project: {
          name: 1,
          price: 1,
          beforePrice: 1,
          category: {
            id: "$categoryDetails._id",
            name: "$categoryDetails.name",
          },
          image: 1,
          devices: 1,
        },
      },
      { $sort: { _id: -1 } }, // ترتيب النتائج بحيث تكون الأحدث أولًا
      { $limit: limit }, // تحديد العدد النهائي للمنتجات ليكون 4 فقط
    ];

    const products = await Product.aggregate(aggregationPipeline);

    return res.status(200).json({ status: 200, products });
  } catch (e) {
    console.error("Error fetching products:", e);
    return res.status(500).json({ error: e.message || e, status: 500 });
  }
});
const mostPopularProducts = asyncHandler(async (req, res) => {
  const limit = 8; // الحد الأقصى لعدد المنتجات المسترجعة

  try {
    // البحث عن المنتجات الأكثر طلبًا بناءً على الطلبات المكتملة
    const popularProducts = await Order.aggregate([
      { $match: { status: "Completed" } }, // الطلبات المكتملة فقط

      {
        $sort: { totalQuantity: -1 }, // ترتيب تنازليًا حسب عدد الطلبات
      },
      { $limit: limit }, // تحديد عدد المنتجات إلى 8 فقط
    ]);

    console.log("Popular Products: ", popularProducts);

    // استخراج معرفات المنتجات الأكثر طلبًا
    const productIds = popularProducts.flatMap((biri) =>
      biri.items.map((item) => item.item.productId)
    );
    console.log("Popular Products: ", productIds);

    let products;
    if (productIds.length > 0) {
      // إذا كان هناك منتجات مشهورة، استرجع تفاصيلها
      products = await Product.find({ _id: { $in: productIds } })
        .populate("category", "name")
        .select("name price beforePrice image devices");
    } else {
      // إذا لم يكن هناك منتجات مشهورة، استرجع آخر 8 منتجات
      products = await Product.find({})
        .sort({ createdAt: -1 }) // ترتيب تنازلي حسب تاريخ الإنشاء
        .limit(limit)
        .populate("category", "name")
        .select("name price beforePrice image devices");
    }

    return res.status(200).json({ status: 200, products });
  } catch (e) {
    console.error("Error fetching popular products:", e);
    return res.status(500).json({
      error: e.message || e,
      status: 500,
    });
  }
});

const updateProductViews = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  try {
    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { views: 1 } }, // زيادة عدد المشاهدات بمقدار 1
      { new: true } // إعادة المنتج بعد التحديث
    );

    if (!product) {
      return res
        .status(404)
        .json({ status: 404, message: "Product not found" });
    }

    return res.status(200).json({ status: 200, product });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e.message });
  }
});

const mostViewedProducts = asyncHandler(async (req, res) => {
  const limit = 8; // عدد المنتجات التي سيتم عرضها

  try {
    const products = await Product.find({})
      .populate("category", "name")
      .select("name price beforePrice image devices")
      .sort({ views: -1 }) // ترتيب تنازلي حسب عدد المشاهدات
      .limit(limit);

    return res.status(200).json({ status: 200, products });
  } catch (e) {
    console.error("Error fetching most viewed products:", e);
    return res.status(500).json({ status: 500, error: e.message });
  }
});
const getProductsByCategory = asyncHandler(async (req, res) => {
  const { subCategory, page = 1, limit = 8 } = req.query;
  const categoryId = req.params.id;

  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return res.status(400).json({ status: 400, message: "Id not valid" });
  }

  try {
    let query = { category: categoryId };
    if (subCategory) {
      query.subCategories = [subCategory];
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .populate("category", "name")
      .select("name price beforePrice views props note image devices")
      .skip(skip)
      .limit(Number(limit));
    const category = await Category.findById(categoryId).select(
      "_id name description"
    );
    const total = await Product.countDocuments(query);

    return res.status(200).json({
      status: 200,
      products,
      total,
      category,
      currentPage: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e.message });
  }
});
const getRelatedProducts = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params; // ID المنتج الحالي
    const currentProduct = await Product.findById(productId).populate(
      "category subCategories"
    );

    if (!currentProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // البحث عن منتجات مرتبطة
    const relatedProducts = await Product.find({
      _id: { $ne: productId }, // استثناء المنتج الحالي
      category: currentProduct.category, // نفس الفئة
    })
      .limit(5) // تحديد العدد الأقصى للنتائج
      .select("name price beforePrice props note image devices");

    res.status(200).json({
      message: "Related products fetched successfully",
      relatedProducts,
    });
  } catch (error) {
    console.error("Error fetching related products:", error);
    res.status(500).json({ message: "Failed to fetch related products" });
  }
});
const searchProducts = asyncHandler(async (req, res) => {
  try {
    const { search } = req.query;
    const products = await Product.find({
      name: { $regex: search, $options: "i" },
    }).select("_id name image");
    return res.status(200).json({ status: 200, products });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e.message });
  }
});

module.exports = {
  getProductsStatistics,
  getCategoriesForProducts,
  getSubCategoriesForProducts,
  createProduct,
  deleteProduct,
  getProducts,
  getProduct,
  updateProduct,
  mainDashboardStatistics,
  lastProducts,
  mostPopularProducts,
  mostViewedProducts,
  updateProductViews,
  getProductsByCategoryHome,
  getProductsByCategory,
  getRelatedProducts,
  searchProducts,
};
/*
 useEffect(() => {
    // استدعاء API لزيادة عدد المشاهدات
    fetch(`/api/products/${productId}/views`, { method: "PATCH" })
      .then((response) => response.json())
      .then((data) => {
        console.log("Views updated:", data);
      })
      .catch((error) => {
        console.error("Error updating views:", error);
      });
  }, [productId]);
*/
