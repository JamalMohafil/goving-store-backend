const express = require("express");
const { isUser } = require("../utils/middleware");
const {
  AddToCart,
  getCartItems,
  getCartItemsCount,
  deleteItemFromCart,
  deleteAllItemsFromCart,
  updateItemQuantity,
  removeCouponFromCart,
  getCartDetails,
} = require("../controllers/cartController");
const router = express.Router();

router.post("/addToCart", isUser, AddToCart);
router.get("/", isUser, getCartItems);
router.get("/getItemsCount", isUser, getCartItemsCount);
router.delete("/:id", isUser, deleteItemFromCart);
router.delete("/", isUser, deleteAllItemsFromCart);
router.put("/:id", isUser, updateItemQuantity);
router.delete("/removeCouponFromCart/:cartId", isUser, removeCouponFromCart);
router.get("/getCartDetails", isUser, getCartDetails);
module.exports = router;
