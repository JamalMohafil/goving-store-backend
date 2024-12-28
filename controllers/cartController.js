const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Cart = require("../models/Cart"); // تأكد من تعديل المسار المناسب لنموذج Cart
const TAX_RATE = 0.05;
const AddToCart = asyncHandler(async (req, res) => {
  try {
    const {
      title,
      props = {}, // افتراض كائن فارغ إذا لم يتم تقديم props
      inputs = [], // افتراض مصفوفة فارغة إذا لم يتم تقديم inputs
      quantity = 1,
      image,
      user,
      productId,
      price,
    } = req.body;

    // التحقق من الحقول المطلوبة
    if (!user || !productId || !title || !price) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // البحث عن السلة الخاصة بالمستخدم
    let cart = await Cart.findOne({ user });

    if (!cart) {
      // إنشاء سلة جديدة إذا لم تكن موجودة
      cart = new Cart({
        user,
        items: [],
        subTotal: "0",
        total: "0",
        taxPrice: 0,
      });
    }
    if (
      req.user.role !== "admin" &&
      req.user._id.toString() !== req.cart.user.toString()
    ) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    // مقارنة قيم الـ inputs
    const areInputsEqual = (cartInputs, newInputs) => {
      if (cartInputs.length !== newInputs.length) return false;
      return cartInputs.every(
        (cartInput, index) => cartInput.value === newInputs[index].value
      );
    };

    // التحقق مما إذا كان المنتج موجودًا بالفعل في السلة
    const existingItemIndex = cart.items.findIndex((item) => {
      // التحقق من تطابق معرف المنتج
      const isSameProduct = item.item.productId.toString() === productId;

      // التحقق من تطابق props.details.title
      const isSamePropsTitle =
        !props.details?.title ||
        item.item.props?.details?.title === props.details?.title;

      // التحقق من تطابق inputs
      const isSameInputs =
        inputs.length === 0 || areInputsEqual(item.item.inputs, inputs);

      // يجب أن تتطابق جميع الشروط
      return isSameProduct && isSamePropsTitle && isSameInputs;
    });

    if (existingItemIndex !== -1) {
      // تحديث الكمية والإجمالي إذا كان المنتج موجودًا بنفس المواصفات
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].totalPrice = (
        cart.items[existingItemIndex].quantity *
        parseFloat(cart.items[existingItemIndex].item.price)
      ).toFixed(2);
    } else {
      // إضافة عنصر جديد إلى السلة
      const calculatedTotalPrice = (quantity * parseFloat(price)).toFixed(2);
      cart.items.push({
        item: { title, productId, inputs, props, image, price },
        quantity,
        totalPrice: calculatedTotalPrice,
      });
    }

    // تحديث الإجماليات
    const subtotal = cart.items.reduce(
      (sum, item) => sum + parseFloat(item.totalPrice),
      0
    );
    cart.subTotal = subtotal.toFixed(2);

    // 2. Calculate tax (5% of subtotal)
    const taxPrice = subtotal * TAX_RATE;
    cart.taxPrice = taxPrice.toFixed(2);

    // 3. Calculate amount after tax
    const subtotalWithTax = subtotal + taxPrice;

    // 4. Calculate discount amount (if discount exists)
    const discountRate = cart.discount || 0;
    const discountAmount = subtotalWithTax * (discountRate / 100);

    // 5. Calculate final total
    const finalTotal = subtotalWithTax - discountAmount;
    cart.total = finalTotal.toFixed(2);

    // حفظ السلة
    await cart.save();

    res.status(200).json({ message: "Item added to cart successfully", cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding item to cart", error });
  }
});
const getCartItems = asyncHandler(async (req, res) => {
  try {
    const user = req.user; // المستخدم من الميدل وير
    const { page = 1, limit = 8 } = req.query; // رقم الصفحة وعدد العناصر لكل صفحة

    if (!user) {
      return res.status(401).json({ message: "Unauthorized. User not found." });
    }

    // البحث عن السلة الخاصة بالمستخدم
    const cart = await Cart.findOne({ user: user._id });
    if (!cart) {
      return res
        .status(200)
        .json({ cart: [], status: 200, message: "No Cart" });
    }
    if (user.role !== "admin" && user._id.toString() !== cart.user.toString()) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    const cartDetails = {
      total: cart.total,
      taxPrice: cart.taxPrice,
      subTotal: cart.subTotal,
      discount: cart.discount,
    };

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Cart is empty" });
    }

    // تنفيذ الـ pagination
    const startIndex = (page - 1) * limit; // بداية العناصر في الصفحة
    const endIndex = page * limit; // نهاية العناصر في الصفحة

    const paginatedItems = cart.items.slice(startIndex, endIndex);

    res.status(200).json({
      totalItems: cart.items.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(cart.items.length / limit),
      itemsPerPage: parseInt(limit),
      items: paginatedItems,
      cartDetails,
      cartId: cart._id,
      appliedCoupon: cart.appliedCoupon || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching cart items", error });
  }
});
const getCartItemsCount = asyncHandler(async (req, res) => {
  try {
    // البحث عن السلة الخاصة بالمستخدم بناءً على user ID
    const user = req.user;
    const cart = await Cart.findOne({ user: req.user._id }).select("items");

    // التحقق من وجود السلة
    if (!cart) {
      return res.status(404).json({ error: "Cart not found", status: 404 });
    }
    if (user.role !== "admin" && user._id.toString() !== cart.user.toString()) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    // حساب عدد العناصر داخل المصفوفة "items"
    const itemsCount = cart.items.length;

    return res.status(200).json({ itemsCount });
  } catch (e) {
    return res.status(400).json({ error: e.message, status: 400 });
  }
});
const deleteItemFromCart = asyncHandler(async (req, res) => {
  try {
    const user = req.user;
    const itemId = req.params.id;

    // 1. التحقق من صحة معرف المنتج
    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        status: 400,
        error: "Invalid item ID provided",
      });
    }

    // 2. البحث عن سلة المستخدم
    const cart = await Cart.findOne({ user: user._id });

    if (!cart) {
      return res.status(404).json({
        status: 404,
        error: "Cart not found",
      });
    }

    // 3. البحث عن المنتج في السلة
    const itemIndex = cart.items.findIndex(
      (cartItem) => cartItem._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        status: 404,
        error: "Item not found in cart",
      });
    }

    // 4. التحقق من الصلاحيات

    if (user.role !== "admin" && user._id.toString() !== cart.user.toString()) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    // 5. حذف المنتج من السلة
    cart.items.splice(itemIndex, 1);

    // 6. إعادة حساب المجاميع
    const subTotal = cart.items
      .reduce((total, item) => {
        return total + (parseFloat(item.totalPrice) || 0);
      }, 0)
      .toFixed(2);

    cart.subTotal = subTotal;
    cart.total = (parseFloat(subTotal) + cart.taxPrice - cart.discount).toFixed(
      2
    );

    // 7. حفظ التغييرات
    await cart.save();

    return res.status(200).json({
      status: 200,
      message: "Item deleted successfully",
      cart: {
        items: cart.items,
        subTotal: cart.subTotal,
        total: cart.total,
        discount: cart.discount,
        taxPrice: cart.taxPrice,
      },
    });
  } catch (error) {
    console.error("Error in deleteItemFromCart:", error);
    return res.status(500).json({
      status: 500,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
const deleteAllItemsFromCart = asyncHandler(async (req, res) => {
  try {
    const cartId = req.query.id;
    const user = req.user;

    // التحقق من صحة معرف السلة
    if (!cartId || !mongoose.Types.ObjectId.isValid(cartId)) {
      return res.status(400).json({ error: "Invalid CartID" });
    }

    // البحث عن السلة
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.status(404).json({ error: "Cart not found", status: 404 });
    }

    if (user.role !== "admin" && user._id.toString() !== cart.user.toString()) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    // حذف السلة
    await cart.deleteOne({ _id: cartId });

    // إرسال استجابة ناجحة
    return res
      .status(200)
      .json({ message: "Cart deleted successfully", status: 200 });
  } catch (e) {
    // التعامل مع الأخطاء
    return res.status(500).json({ status: 500, error: e.message });
  }
});
const updateItemQuantity = asyncHandler(async (req, res) => {
  try {
    const itemId = req.params.id;
    const quantity = parseInt(req.query.quantity);
    const user = req.user;
    // التحقق من الأذونات

    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      return res
        .status(400)
        .json({ status: 400, error: "ItemID is not valid" });
    }

    if (!quantity || quantity < 1) {
      return res
        .status(400)
        .json({ status: 400, error: "Quantity must be a positive number" });
    }

    const cart = await Cart.findOne({
      user: req.user._id,
      "items._id": itemId,
    }).exec();
    if (user.role !== "admin" && user._id.toString() !== cart.user.toString()) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    if (!cart) {
      return res
        .status(404)
        .json({ status: 404, error: "Cart or item not found" });
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId
    );
    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ status: 404, error: "Item not found in cart" });
    }

    const item = cart.items[itemIndex];
    const itemPrice = parseFloat(item.item.price);
    const newTotalPrice = (itemPrice * quantity).toString();

    const result = await Cart.updateOne(
      { _id: cart._id, "items._id": itemId },
      {
        $set: {
          "items.$.quantity": quantity,
          "items.$.totalPrice": newTotalPrice,
        },
      }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ status: 404, error: "Failed to update item" });
    }

    const updatedCart = await Cart.findById(cart._id);
    const subTotal = updatedCart.items
      .reduce((sum, item) => sum + parseFloat(item.totalPrice), 0)
      .toString();

    const taxPrice = parseFloat(subTotal) * TAX_RATE;
    const subtotalWithTax = parseFloat(subTotal) + taxPrice;
    const discountAmount = subtotalWithTax * (updatedCart.discount / 100);
    const total = (subtotalWithTax - discountAmount).toString();

    await Cart.updateOne(
      { _id: cart._id },
      {
        $set: {
          subTotal,
          taxPrice,
          total,
        },
      }
    );

    const finalCart = await Cart.findById(cart._id);
    return res.status(200).json({
      status: 200,
      message: "Cart updated successfully",
      cart: finalCart,
    });
  } catch (error) {
    console.error("Error updating cart item quantity:", error);
    return res.status(500).json({
      status: 500,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});
const removeCouponFromCart = asyncHandler(async (req, res) => {
  const cartId = req.params.cartId;
  const user = req.user;
  console.log(cartId, user);
  try {
    // التحقق من الأذونات
    if (!cartId || !mongoose.Types.ObjectId.isValid(cartId)) {
      return res.status(400).json({ status: 400, error: "Invalid CartID" });
    }
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.status(404).json({ status: 404, error: "Cart not found" });
    }
    if (user.role !== "admin" && user._id.toString() !== cart.user.toString()) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    cart.discount = 0;
    cart.appliedCoupon = { code: "", discountPercent: "" };

    await cart.save();

    return res.status(200).json({
      status: 200,
      message: "Coupon removed successfully",
    });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e.message });
  }
});
const getCartDetails = asyncHandler(async (req, res) => {
  try {
    const user = req.user;

    const cart = await Cart.findOne(
      { user: req.user._id },
      "total taxPrice subTotal discount user"
    ).lean();

    if (!cart) {
      return res.status(404).json({ status: 404, error: "Cart not found" });
    }

    if (user.role !== "admin" && user._id.toString() !== cart.user.toString()) {
      return res.status(401).json({ status: 401, error: "Unauthorized" });
    }

    const cartDetails = {
      total: cart.total,
      taxPrice: cart.taxPrice,
      subTotal: cart.subTotal,
      discount: cart.discount,
    };

    return res.status(200).json({ cartDetails, status: 200 });
  } catch (e) {
    return res.status(500).json({ status: 500, error: e.message });
  }
});
module.exports = {
  AddToCart,
  getCartDetails,
  getCartItems,
  getCartItemsCount,
  deleteItemFromCart,
  deleteAllItemsFromCart,
  updateItemQuantity,
  removeCouponFromCart,
};
