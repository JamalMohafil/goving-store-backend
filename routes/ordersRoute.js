const express = require("express");
const {
  getOrdersStatistics,
  getOrders,
  createOrder,
  getOrderThanks,
  getOrderInformation,
  getAdminOrderInformation,
  updateOrderStatus,
} = require("../controllers/orderControllers");
const router = express.Router();
const { isAdmin, isUser } = require("../utils/middleware");

router.get("/statistics", isAdmin, getOrdersStatistics);
router.get("/", isAdmin, getOrders);
router.post("/", isUser, createOrder);
router.get("/getOrderThanks/:id", isUser, getOrderThanks);
router.get("/adminOrder/:id", isAdmin, getAdminOrderInformation);
router.put("/updateStatus/:id", isAdmin, updateOrderStatus);
router.get("/:id", isUser, getOrderInformation);

module.exports = router;
