const jwt = require("jsonwebtoken");
const User = require("../models/User");

const isAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // استخراج التوكن من الهيدر

  if (!token) {
    return res.status(401).json({ message: "Unauthorized, token not found" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied, admin only" });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized, invalid token" });
  }
};

const isUser = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Unauthorized, invalid token" });
  }
};

module.exports = {isAdmin,isUser}
