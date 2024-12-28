const asyncHandler = require("express-async-handler");
const SubCategory = require("../models/SubCategory");
const Product = require("../models/Product");
const Category = require("../models/Category");

const getSubcategoriesStatistics = asyncHandler(async (req, res) => {
  try {
    // حساب عدد التصنيفات الفرعية
    const subCategoriesCount = await SubCategory.countDocuments();

    // حساب عدد المنتجات التي تحتوي على تصنيفات فرعية
    const totalProductsThatHaveSubCategories = await Product.countDocuments({
      subCategories: { $exists: true, $not: { $size: 0 } },
    });

    // حساب متوسط المنتجات لكل تصنيف فرعي
    const avgProductsPerSubCategory =
      subCategoriesCount > 0
        ? totalProductsThatHaveSubCategories / subCategoriesCount
        : 0;

    return res.status(200).json({
      totalSubCategories: subCategoriesCount,
      totalProductsThatHaveSubCategories,
      avgProductsPerSubCategory,
      status: 200,
    });
  } catch (e) {
    return res.status(400).json({ message: e.message, status: 400 });
  }
});
const getSubCategories = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 6;
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search?.trim();
  const filter = req.query.filter;

  const searchQuery = search
    ? {
        $or: [{ name: { $regex: search, $options: "i" } }],
      }
    : {};

  let filterQuery = {};
  if (filter && filter !== "all") {
    // تأكد من أن هذا هو تعريف التصنيفات الرئيسية
    filterQuery = { category: filter }; // استخدم filter مباشرة إذا كان معرف تصنيف رئيسي
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
        $unwind: {
          path: "$categoryDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "subCategory",
          as: "products",
        },
      },
      {
        $addFields: {
          productCount: { $size: "$products" },
        },
      },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ];

    const [subCategories, totalCount] = await Promise.all([
      SubCategory.aggregate(aggregationPipeline),
      SubCategory.countDocuments(query),
    ]);

    const formattedSubCategories = subCategories.map((subCategory) => ({
      id: subCategory._id,
      name: subCategory.name,
      mainCat: subCategory.category,
      icon: subCategory.icon,
      category: subCategory.categoryDetails || null,
      productCount: subCategory.productCount,
    }));

    res.json({
      totalSubCategories: totalCount,
      subCategories: formattedSubCategories,
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (e) {
    return res.status(400).json(e);
  }
});

const getSubCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const subCategory = await SubCategory.findById(id);
    if (!subCategory) {
      return res.json({ status: 401, message: "No subcategory found" });
    }
    return res.json({ status: 201, subCategory });
  } catch (e) {
    return res.status(500).json(e);
  }
});
const createSubCategory = asyncHandler(async (req, res) => {
  try {
    const { name, category, icon } = req.body;

    // تحقق من وجود الحقول المطلوبة
    if (!name || !category) {
      return res
        .status(400)
        .json({ message: "Name and category are required." });
    }

    // إنشاء بيانات التصنيف الفرعي
    const newSubCategoryData = {
      name,
      category, // category._id يجب أن يكون هنا
    };

    // إضافة الحقل icon إذا كان موجودًا
    if (icon) {
      newSubCategoryData.icon = icon;
    }

    // إنشاء تصنيف فرعي جديد
    const newSubCategory = new SubCategory(newSubCategoryData);

    // حفظ التصنيف الفرعي في قاعدة البيانات
    const savedSubCategory = await newSubCategory.save();

    // الآن نقوم بتحديث التصنيف الرئيسي لإضافة التصنيف الفرعي إلى الـ subCategories
    const updatedCategory = await Category.findByIdAndUpdate(
      category, // يجب أن يكون _id الخاص بالتصنيف
      {
        $push: { subCategories: savedSubCategory._id }, // إضافة _id للتصنيف الفرعي في الـ subCategories
      },
      { new: true } // لتحديث الكائن المرجعي الجديد بعد التحديث
    );
    

    // إذا لم يتم العثور على التصنيف الرئيسي
    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found." });
    }
    
    // إرجاع التصنيف الفرعي الجديد مع التصنيف المحدث
    res.status(201).json({
      status: 201,
      subCategory: savedSubCategory,
      updatedCategory: updatedCategory,
    });
  } catch (error) {
    // التعامل مع الأخطاء
    res.status(500).json({ status: 500, message: error.message });
  }
});

const deleteSubCategory = asyncHandler(async (req, res) => {
  const { id } = req.params; // الحصول على معرف التصنيف الفرعي من معلمات الطلب

  try {
    // تحقق من وجود التصنيف الفرعي
    const subCategory = await SubCategory.findById(id);
    if (!subCategory) {
      return res.status(404).json({ message: "SubCategory not found" });
    }

    // حذف التصنيف الفرعي
    await SubCategory.findByIdAndDelete(id);

    res.status(200).json({ message: "SubCategory deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
});
const updateSubCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, icon } = req.body;

    // تخزين الحقول التي سيتم تحديثها
    const updateFields = {};
    if (name) updateFields.name = name;
    if (icon) updateFields.icon = icon;
    if (category && category !== undefined) updateFields.category = category;

    // العثور على التصنيف الفرعي
    const subCategory = await SubCategory.findById(id);
    if (!subCategory) {
      return res.status(404).json({ message: "SubCategory does not exist" });
    }

    // إذا تم تغيير التصنيف الرئيسي
    if (category && category !== subCategory.category.toString()) {
      // أولاً، إزالة التصنيف الفرعي من التصنيف القديم
      await Category.findByIdAndUpdate(subCategory.category, {
        $pull: { subCategories: subCategory._id },
      });

      // إضافة التصنيف الفرعي إلى التصنيف الجديد
      await Category.findByIdAndUpdate(category, {
        $push: { subCategories: subCategory._id },
      });
    }

    // تحديث التصنيف الفرعي بناءً على الحقول المرسلة
    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
      id,
      updateFields,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(201).json({
      message: "SubCategory updated successfully",
      status: 201,
      subCategory: updatedSubCategory,
    });
  } catch (e) {
    return res.status(500).json({ message: "Server error", error: e.message });
  }
});

module.exports = {
  getSubcategoriesStatistics,
  getSubCategories,
  createSubCategory,
  deleteSubCategory,
  getSubCategory,
  updateSubCategory,
};
