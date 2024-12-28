// models/Cart.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      item: {
        title: String,
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        inputs: [{ title: String, value: String }],
        props: {
          type: {
            title: { type: String, default: "" },
            details: {
              type: {
                title: { type: String, default: "" },
              },
            },
          },
          default: {},
        },
        image: String,
        price: String,
      },
      totalPrice: String,
      quantity: {
        type: Number,
        required: true,
      },
    },
  ],
  subTotal: {
    type: String,
    required: true,
  },
  total: {
    type: String,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  taxPrice: {
    type: Number,
    default: 0,
  },
  appliedCoupon: {
    code: String,
    discountPercent: Number,
  },
});

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
