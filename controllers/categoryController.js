const asyncHandler = require("express-async-handler");
const Category = require("../models/Category");
const Product = require("../models/Product");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const SubCategory = require("../models/SubCategory");
const fs = require("fs").promises;

const createCategory = asyncHandler(async (req, res) => {
  try {
    const { name, description, icon } = req.body;

    if (!name || !icon) {
      return res.status(400).json({
        status: 400,
        message: "الاسم والأيقونة مطلوبان",
      });
    }

    let imagePath = ""; // المسار الافتراضي للصورة

    // التحقق مما إذا كان هناك صورة مرفقة
    if (req.file) {
      const uploadedFilePath = req.file.path;

      // إنشاء اسم جديد للملف المعالج
      const fileName = `processed-${path.basename(uploadedFilePath)}`;
      const outputPath = path.join("uploads", fileName);

      // معالجة الصورة باستخدام Sharp
      await sharp(uploadedFilePath)
        .resize(300, 300)
        .jpeg({ quality: 80 })
        .toFile(outputPath);

      // تأخير بسيط قبل حذف الملف الأصلي بعد المعالجة
      setTimeout(async () => {
        try {
          await fs.unlink(uploadedFilePath);
        } catch (error) {
          console.error("Error deleting original file after delay:", error);
        }
      }, 100); // التأخير 100 ميلي ثانية

      // تحديد مسار الصورة للتخزين في قاعدة البيانات
      imagePath = `/uploads/${fileName}`;
    }

    // إنشاء تصنيف جديد
    const newCategory = new Category({
      name,
      image: imagePath || "",
      description: description || "",
      icon,
      subCateogries: {},
    });

    const savedCategory = await newCategory.save();

    res.status(201).json({
      status: 201,
      message: "تم إنشاء الفئة بنجاح",
      category: savedCategory,
    });
  } catch (error) {
    if (req.file) {
      try {
        // إضافة تأخير قبل الحذف لضمان عدم تعارض القفل
        setTimeout(async () => {
          const processedPath = path.join(
            "uploads",
            `processed-${path.basename(req.file.path)}`
          );
          try {
            if (
              await fs
                .access(req.file.path)
                .then(() => true)
                .catch(() => false)
            ) {
              await fs.unlink(req.file.path);
            }
            if (
              await fs
                .access(processedPath)
                .then(() => true)
                .catch(() => false)
            ) {
              await fs.unlink(processedPath);
            }
          } catch (unlinkError) {
            console.error("Error deleting files:", unlinkError);
          }
        }, 100);
      } catch (unlinkError) {
        console.error("Error handling deletion on error:", unlinkError);
      }
    }

    res.status(500).json({
      message: "فشل في إنشاء الفئة",
      error: error.message,
    });
  }
});

const getCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.json({ status: 401, message: "No category found" });
    }
    return res.json({ status: 201, category });
  } catch (e) {
    return res.status(500).json(e);
  }
});
const getCategoryMeta = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.json({ status: 401, message: "No category found" });
    }
    return res.json({
      status: 201,
      category: {
        title: category.name,
        description: category.description,
        image: category.image,
        _id: category._id,
      },
    });
  } catch (e) {
    return res.status(500).json(e);
  }
});
const getCategoriesStatistics = asyncHandler(async (req, res) => {
  try {
    // 1. جلب عدد الفئات
    const totalCategories = await Category.countDocuments();

    // 2. جلب عدد المنتجات التي تحتوي على فئات
    const totalProductsWithCategories = await Product.countDocuments({
      category: { $exists: true, $ne: null },
    });

    // 3. حساب متوسط عدد المنتجات لكل فئة
    const avgProductsPerCategory =
      totalCategories > 0
        ? (totalProductsWithCategories / totalCategories).toFixed(2)
        : "0.00";

    // 4. جلب الفئات مع عدد المنتجات لكل فئة وتضمين معلومات الفئة
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
      {
        $project: {
          icon: "$icon",
          name: "$name", // استخدام الحقل name بدلاً من title
          totalProducts: { $size: "$products" },
        },
      },
      {
        $sort: { totalProducts: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    // 5. حساب نسبة المنتجات لكل فئة مع التعامل مع الأسماء بشكل صحيح
    const topCategories = categories.map((category) => ({
      icon: category.icon || "",
      name: category.name || "Unnamed Category", // محاولة استخدام name أولاً ثم title
      percentage:
        totalProductsWithCategories > 0
          ? `${(
              (category.totalProducts / totalProductsWithCategories) *
              100
            ).toFixed(2)}`
          : "0",
    }));

    // 6. إذا كانت topCategories فارغة، إظهار أحدث التصنيفات
    if (topCategories.length === 0) {
      const latestCategories = await Category.find()
        .select("name icon title -_id")
        .sort({ createdAt: -1 })
        .limit(5);

      latestCategories.forEach((category) => {
        console.log(category);
        topCategories.push({
          name: category.name || category.title || "Unnamed Category",
          percentage: "0",
          icon: categories.icon || "",
        });
      });
    }

    const totalProducts = await Product.countDocuments();

    // 7. إعداد البيانات للرد
    const statistics = {
      totalProducts,
      totalCategories,
      totalProductsWithCategories,
      avgProductsPerCategory,
      topCategories,
    };

    // إضافة console.log للتحقق من البيانات
    console.log("Categories from aggregation:", categories);
    console.log("Final topCategories:", topCategories);

    res.status(200).json(statistics);
  } catch (error) {
    console.error("Error in getCategoriesStatistics:", error);
    res.status(500).json({ message: error.message });
  }
});
const getCategories = asyncHandler(async (req, res) => {
  try {
    // 1. الحصول على قيمة page و limit و search من استعلامات URL
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const searchTerm = req.query.search || "";
    console.log(searchTerm);
    // 2. إنشاء شروط البحث
    const searchQuery = searchTerm
      ? {
          $or: [
            { name: { $regex: searchTerm, $options: "i" } },
            { description: { $regex: searchTerm, $options: "i" } },
          ],
        }
      : {};

    // 3. حساب عدد العناصر التي يجب تخطيها
    const skip = (page - 1) * limit;

    // 4. استرجاع التصنيفات مع تطبيق البحث والترتيب
    const categories = await Category.find(searchQuery)
      .sort({ createdAt: -1 }) // ترتيب حسب تاريخ الإنشاء (الأحدث أولاً)
      .skip(skip)
      .limit(limit);

    // 5. حساب إجمالي عدد التصنيفات التي تطابق البحث
    const totalCategories = await Category.countDocuments(searchQuery);

    // 6. حساب عدد الصفحات
    const totalPages = Math.ceil(totalCategories / limit);

    // 7. التحقق من صحة رقم الصفحة
    if (page > totalPages && totalPages > 0) {
      return res.status(404).json({
        message: "Page not found",
        currentPage: totalPages,
        totalPages,
      });
    }

    // 8. التحقق من وجود تصنيفات
    if (totalCategories === 0) {
      return res.status(200).json({
        message: searchTerm
          ? "No categories found matching your search."
          : "No categories available.",
        totalCategories: 0,
        totalPages: 0,
        currentPage: 1,
        categories: [],
      });
    }

    // 9. إرسال النتائج
    res.status(200).json({
      totalCategories,
      totalPages,
      currentPage: page,
      categories,
      message: searchTerm
        ? `Found ${totalCategories} categories matching "${searchTerm}"`
        : undefined,
    });
  } catch (e) {
    console.error("Error fetching categories:", e);
    return res.status(500).json({
      message: "Error fetching categories",
      error: e.message,
    });
  }
});
const deleteCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // تأكد من وجود `id` في المعاملات

    // حذف التصنيف من قاعدة البيانات بناءً على `id`
    const deletedCategory = await Category.findByIdAndDelete(id); // يفترض أن `Category` هو الموديل الخاص بالتصنيفات

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to delete category", error });
  }
});
const updateCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon } = req.body;

    // إعداد الحقول التي تحتاج إلى تحديث
    const updateFields = {};
    if (name) updateFields.name = name;
    if (icon) updateFields.icon = icon;
    if (description) updateFields.description = description;

    // التحقق مما إذا كانت هناك صورة مرفقة
    if (req.file) {
      const uploadedFilePath = req.file.path;

      // إنشاء اسم جديد للملف المعالج
      const fileName = `processed-${path.basename(uploadedFilePath)}`;
      const outputPath = path.join("uploads", fileName);

      // معالجة الصورة باستخدام Sharp
      await sharp(uploadedFilePath)
        .resize(300, 300)
        .jpeg({ quality: 90 })
        .toFile(outputPath);

      // تأخير قصير قبل حذف الملف الأصلي بعد المعالجة
      setTimeout(async () => {
        try {
          await fs.unlink(uploadedFilePath);
        } catch (error) {
          console.error("Error deleting original file after delay:", error);
        }
      }, 100);

      // تحديد مسار الصورة للتخزين في قاعدة البيانات
      updateFields.image = `/uploads/${fileName}`;
    }

    // تحديث التصنيف وإرجاع النسخة المحدثة
    const category = await Category.findByIdAndUpdate(id, updateFields, {
      new: true,
    });

    if (!category) {
      return res.status(404).json({ message: "Category does not exist" });
    }

    res.status(201).json({
      message: "Category updated successfully",
      status: 201,
      category,
    });
  } catch (error) {
    if (req.file) {
      try {
        // تأخير قبل الحذف لضمان عدم تعارض القفل
        setTimeout(async () => {
          const processedPath = path.join(
            "uploads",
            `processed-${path.basename(req.file.path)}`
          );
          try {
            if (
              await fs
                .access(req.file.path)
                .then(() => true)
                .catch(() => false)
            ) {
              await fs.unlink(req.file.path);
            }
            if (
              await fs
                .access(processedPath)
                .then(() => true)
                .catch(() => false)
            ) {
              await fs.unlink(processedPath);
            }
          } catch (unlinkError) {
            console.error("Error deleting files:", unlinkError);
          }
        }, 100);
      } catch (unlinkError) {
        console.error("Error handling deletion on error:", unlinkError);
      }
    }

    res.status(500).json({
      message: "A problem occurred, try again later",
      error: error.message,
    });
  }
});
const getCategoriesForFilter = asyncHandler(async (req, res) => {
  try {
    // 1. الحصول على قيمة limit و search من استعلامات URL
    const limit = parseInt(req.query.limit);
    const searchTerm = req.query.search || "";
    console.log(searchTerm);

    // 2. إنشاء شروط البحث
    const searchQuery = searchTerm
      ? {
          $or: [{ name: { $regex: searchTerm, $options: "i" } }],
        }
      : {};

    // 3. بناء استعلام البحث مع الترتيب
    const query = Category.find(searchQuery)
      .select("name icon")
      .sort({ createdAt: -1 });

    // 4. إذا كان limit موجودًا، أضف limit إلى الاستعلام، وإلا استرجع جميع التصنيفات
    if (!isNaN(limit)) {
      query.limit(limit);
    }

    const categories = await query;

    // 5. التحقق من وجود تصنيفات
    if (categories.length === 0) {
      return res.status(200).json({
        message: searchTerm
          ? "No categories found matching your search."
          : "No categories available.",
        categories: [],
      });
    }

    // 6. إرسال النتائج
    res.status(200).json({
      categories,
      message: searchTerm
        ? `Found ${categories.length} categories matching "${searchTerm}"`
        : undefined,
    });
  } catch (e) {
    console.error("Error fetching categories:", e);
    return res.status(500).json({
      message: "Error fetching categories",
      error: e.message,
    });
  }
});
const getLastCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ createdAt: -1 })
      .select("_id name icon description")
      .limit(6);
    res.status(200).json({ status: 200, categories });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching categories", error: error.message });
  }
});
const getNavCategories = asyncHandler(async (req, res) => {
  try {
    // البحث عن التصنيفات التي تحتوي على تصنيفات فرعية مع تحديد الحقول المطلوبة فقط
    const categoriesWithSubCategories = await Category.find({
      subCategories: { $exists: true },
    }).populate({
      path: "subCategories",
      select: "_id name icon", // تحديد الحقول المطلوبة فقط للتصنيفات الفرعية
    });

    // إذا كان عدد التصنيفات مع التصنيفات الفرعية أكثر من 8
    if (categoriesWithSubCategories.length >= 8) {
      return res.status(200).json({
        status: 200,
        categories: categoriesWithSubCategories.slice(0, 8), // عرض أول 8 فقط
      });
    }

    // إذا كانت التصنيفات مع التصنيفات الفرعية أقل من 8
    const remainingCategoriesCount = 8 - categoriesWithSubCategories.length;

    // البحث عن تصنيفات لا تحتوي على تصنيفات فرعية
    const categoriesWithoutSubCategories = await Category.find({
      subCategories: { $exists: false },
    }).limit(remainingCategoriesCount);

    // دمج التصنيفات مع التصنيفات الفرعية والتصنيفات بدون تصنيفات فرعية
    const allCategories = [
      ...categoriesWithSubCategories,
      ...categoriesWithoutSubCategories,
    ];

    return res.status(200).json({
      status: 200,
      categories: allCategories,
    });
  } catch (e) {
    // التعامل مع الأخطاء
    return res.status(500).json({ status: 500, error: e.message || e });
  }
});
const getHomeCategories = asyncHandler(async (req, res) => {
  try {
    // البحث عن التصنيفات التي تحتوي على تصنيفات فرعية مع تحديد الحقول المطلوبة فقط
    const categories = await Category.find().select("image _id");

    return res.status(200).json({
      status: 200,
      categories,
    });
  } catch (e) {
    // التعامل مع الأخطاء
    return res.status(500).json({ status: 500, error: e.message || e });
  }
});
const getAllCategories = asyncHandler(async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // الصفحة الحالية (افتراضي 1)
    const limit = parseInt(req.query.limit) || 8; // عدد العناصر لكل صفحة (افتراضي 8)
    const skip = (page - 1) * limit; // عدد العناصر التي سيتم تخطيها

    // استعلام التصنيفات مع التخطي والحد
    const categories = await Category.find()
      .populate("subCategories")
      .skip(skip)
      .limit(limit);
    const totalCategories = await Category.countDocuments(); // العدد الإجمالي للتصنيفات
    const totalPages = Math.ceil(totalCategories / limit); // إجمالي عدد الصفحات

    return res.status(200).json({
      status: 200,
      categories,
      currentPage: page,
      totalPages,
    });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e });
  }
});

module.exports = {
  createCategory,
  getCategoriesStatistics,
  getCategories,
  deleteCategory,
  updateCategory,
  getCategory,
  getCategoriesForFilter,
  getLastCategories,
  getNavCategories,
  getHomeCategories,
  getAllCategories,
  getCategoryMeta,
};
