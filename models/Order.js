const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema(
  {
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
    paymentDetails: {
      cardNumber: Number,
      cardHolderName: String,
      expirationDate: String,
      cvv: Number,
    },
    orderNumber: {
      type: String,
      required: true,
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      default: "Completed",
      enum: ["Completed", "Cancelled"],
    },
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
    status: {
      type: String,
      enum: ["Pending", "Processing","Restitute", "Completed", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

// إنشاء فهرس على الحقل `status` لتحسين الأداء عند البحث
orderSchema.index({ status: 1 });

module.exports = mongoose.model("Order", orderSchema);
