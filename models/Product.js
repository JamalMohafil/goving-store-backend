const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    banner: {
      type: String,
      default: "",
    },
    image: {
      type: String,
      default: "",
    },
    price: {
      type: String,
      required: true,
    },
    inputs: [
      {
        name: {
          type: String,
        },
        inputType: {
          type: String,
          default: "text",
        },
        description: String,
      },
    ],
    props: {
      default: [],
      typeOfProps: { type: String, default: "" },
      title: { type: String, default: "" },
      details: {
        type: [
          {
            title: { type: String, default: "" },
            price: { type: Number, default: 0 },
            quantity: { type: Number, default: 0 },
          },
        ],
        default: [], 
      },
    },
    quantity: {
      type: Number,
      required: true,
    },
    beforePrice: {
      type: String,
    },
    note: {
      type: String,
      default: "",
    },
    category: {
      type: mongoose.Schema.Types.ObjectId, // مصفوفة معرفات الفئات الفرعية
      ref: "Category",
      default: null, // تعيين القيمة الافتراضية إلى null
    },
    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId, // مصفوفة معرفات الفئات الفرعية
        ref: "SubCategory",
      },
    ],
    devices: {
      type: [String],
      enum: ["XBOX", "PHONE", "PC", "PLAYSTATION"],
      validate: {
        validator: function (value) {
          return value.every((item) =>
            ["XBOX", "PHONE", "PC", "PLAYSTATION"].includes(item)
          );
        },
        message:
          "Invalid device type. Allowed values are: XBOX, PHONE, PC, PLAYSTATION.",
      },
    },
    rating: {
      type: String,
      default: "0",
    },
    reviews: [{ type: mongoose.Schema.Types.ObjectId, ref: "Review" }],
    views: {
      type: Number,
      default: 0, // القيمة الافتراضية
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
