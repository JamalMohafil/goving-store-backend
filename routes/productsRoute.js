const express = require("express");
const {
  getProductsStatistics,
  getCategoriesForProducts,
  getSubCategoriesForProducts,
  createProduct,
  deleteProduct,
  getProducts,
  getProduct,
  updateProduct,
  lastProducts,
  mostPopularProducts,
  updateProductViews,
  mostViewedProducts,
  getProductsByCategory,
  getProductsByCategoryHome,
  getRelatedProducts,
  searchProducts,
} = require("../controllers/productController");
const router = express.Router();
const { isAdmin } = require("../utils/middleware");
const upload = require("../utils/uploadMiddleware");

router.get("/statistics", isAdmin, getProductsStatistics);
router.get("/", isAdmin, getProducts);
router.get("/lastProducts", lastProducts);
router.get("/mostPopularProducts", mostPopularProducts);
router.get("/mostViewedProducts", mostViewedProducts);
router.get("/categoryHome/:id", getProductsByCategoryHome);
router.get("/category/:id",getProductsByCategory)
router.patch("/:productId/views", updateProductViews);

router.delete("/:id", isAdmin, deleteProduct);
router.post(
  "/",
  isAdmin,
  upload.fields([
    { name: "banner", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  createProduct
);
router.put(
  "/:id",
  isAdmin,
  upload.fields([
    { name: "banner", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  updateProduct
);
router.get("/categoriesForProducts", isAdmin, getCategoriesForProducts);
router.get("/subCategoriesForProducts", isAdmin, getSubCategoriesForProducts);
router.get("/:id", getProduct);
router.get("/relatedProducts/:productId", getRelatedProducts);
router.post("/search", searchProducts);
module.exports = router;
