const express = require("express");

const router = express.Router();

const {
  createReview,
  getReviewsByProductId,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");
const { isUser } = require("../utils/middleware");

router.post("/", isUser, createReview);
router.get("/:productId", getReviewsByProductId);
router.put("/:reviewId", isUser, updateReview);
router.delete("/:reviewId", isUser, deleteReview);
module.exports = router;
