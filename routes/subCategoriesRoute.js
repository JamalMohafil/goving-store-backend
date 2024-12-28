const express = require("express");
const {
  getSubcategoriesStatistics,
  getSubCategories,
  createSubCategory,
  deleteSubCategory,
  getSubCategory,
  updateSubCategory,
} = require("../controllers/subCategoryController");
const { isAdmin } = require("../utils/middleware");

const router = express.Router();
router.get("/getStatistics", isAdmin, getSubcategoriesStatistics);
router.get("/", getSubCategories);
router.post("/", isAdmin, createSubCategory);
router.delete("/:id", isAdmin, deleteSubCategory);
router.get("/:id", getSubCategory);
router.put("/:id", isAdmin, updateSubCategory);

module.exports = router;
