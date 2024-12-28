const express = require("express");
const router = express.Router();
const {
  createCategory,
  getCategoriesStatistics,
  getCategories,
  deleteCategory,
  getCategory,
  updateCategory,
  getCategoriesForFilter,
  getLastCategories,
  getNavCategories,
  getHomeCategories,
  getAllCategories,
  getCategoryMeta,
} = require("../controllers/categoryController");
const { isAdmin } = require("../utils/middleware");
const upload = require("../utils/uploadMiddleware");
// إضافة `upload.single("image")` كوسيط لرفع الملف عبر `multer`
// حيث "image" هو اسم الحقل الذي يحمل الملف في الطلب
router.post("/", isAdmin, upload.single("image"), createCategory);
router.get("/", isAdmin, getCategories);
router.get("/getNavCategories", getNavCategories);
router.get("/getHomeCategories", getHomeCategories);
router.get("/forFilter", isAdmin, getCategoriesForFilter);

router.get("/lastCategories", isAdmin, getLastCategories);
router.get("/statistics", isAdmin, getCategoriesStatistics);
router.delete("/:id", isAdmin, deleteCategory);
router.put("/:id", isAdmin, upload.single("image"), updateCategory);
router.get("/:id", isAdmin, getCategory);
router.get("/:id/meta", getCategoryMeta);
module.exports = router;
