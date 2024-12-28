const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    icon: {
      type: String,

      required: true,
    },
    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId, // مصفوفة معرفات الفئات الفرعية
        ref: "SubCategory",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema)