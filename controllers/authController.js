const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Function to validate request body
const validateRequestBody = (body, requiredFields) => {
  for (const field of requiredFields) {
    if (!body[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
};

// Register User
// POST /api/v1/auth/register
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  // Validate request body
  try {
    validateRequestBody(req.body, ["name", "email", "password"]);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    return res
      .status(400)
      .json({ status: 400, message: "User already exsist" });
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
  });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  // Respond with user data and token
  if (user) {
    res.status(201).json({
      status: 201,
      user: {
        _id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        token: token,
      },
    });
  } else {
    res.status(400);
    throw new Error("Invalid user data");
  }
});

// Login User
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate request body
  if (!email || !password) {
    return res.json({
      status: 400,
      message: "Please enter email and password",
    });
  }

  // Find user by email
  const user = await User.findOne({ email });

  // Check if user exists
  if (!user) {
    return res.json({
      status: 401,
      message: "User with this email does not exist.",
    });
  }

  // Check if the password matches
  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res.json({
      status: 401,
      message: "Incorrect password.",
    });
  }
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d", // صلاحية التوكن لمدة ساعة مثلاً
  });

  // If all is good, return user data and token
  res.json({
    status: 200,
    user: {
      _id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      token: token,
    },
  });
});
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Validate request body
  try {
    validateRequestBody(req.body, ["currentPassword", "newPassword"]);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }

  // Find user by token
  const user = await User.findById(req.user._id); // assuming you have middleware to extract user ID from token
  if (!user) {
    return res.status(404).json({
      status: 404,
      message: "User not found.",
    });
  }

  // Check if the current password is correct
  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.password
  );
  if (!isPasswordCorrect) {
    return res.status(401).json({
      status: 401,
      message: "Current password is incorrect.",
    });
  }

  // Hash the new password
  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  // Update the user's password
  user.password = hashedNewPassword;
  await user.save();

  res.status(200).json({
    status: 200,
    message: "Password changed successfully.",
  });
});

module.exports = { registerUser, loginUser, changePassword };
