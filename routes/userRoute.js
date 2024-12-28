const express = require("express");
const router = express.Router();
const User = require("../models/User");
const {
  loginUser,
  registerUser,
  changePassword,
} = require("../controllers/authController");
const {
  getUserOrders,
  getUserByToken,
  updateUser,
  getUsersStatistics,
  getUsers,
  deleteUser,
  getUser,
  updateUserAdmin,
  createUser,
} = require("../controllers/userController");
const { isUser, isAdmin } = require("../utils/middleware");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/:id/orders", isUser, getUserOrders);
router.get("/users-statistics", isAdmin, getUsersStatistics);
router.get("/getAllUsers", isAdmin, getUsers);
// Get User By Token
router.get("/me", isUser, getUserByToken);
router.put("/:id", isUser, updateUser);
router.post("/change-password", isUser, changePassword);
router.delete("/:id", isAdmin, deleteUser);
router.get("/getUser/:id", isUser, getUser);
router.put("/updateUser/:id", isAdmin, updateUserAdmin);
router.post("/createUser", isAdmin, createUser);
module.exports = router;
