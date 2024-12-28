const express = require("express");
const { isAdmin, isUser } = require("../utils/middleware");
const {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponsStatistics,
  applyCoupon,
} = require("../controllers/couponController");
const router = express.Router();

router.get("/", isAdmin, getCoupons);
router.get("/statistics", isAdmin, getCouponsStatistics);
router.post("/", isAdmin, createCoupon);
router.put("/:id", isAdmin, updateCoupon);
router.delete("/:id", isAdmin, deleteCoupon);
router.post("/applyCoupon", isUser, applyCoupon);

module.exports = router;
