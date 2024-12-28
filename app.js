const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const userRoute = require("./routes/userRoute");
const productsRoute = require("./routes/productsRoute");
const categoriesRoute = require("./routes/categoriesRoute");
const subCategoriesRoute = require("./routes/subCategoriesRoute");
const couponsRoute = require("./routes/couponsRoute");
const ordersRoute = require("./routes/ordersRoute");
const reviewsRoute = require("./routes/reviewsRoute");
const cartRoute = require("./routes/cartRoute");
const { isAdmin } = require("./utils/middleware");
const { mainDashboardStatistics } = require("./controllers/productController");
const { getAllCategories } = require("./controllers/categoryController");

dotenv.config(); // تحميل متغيرات البيئة من ملف .env

const app = express();
const server = http.createServer(app);

// Middleware

app.use(cors());
const compression = require("compression");
app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev"));

// إعداد مسار الملفات الثابتة
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// الاتصال بقاعدة البيانات MongoDB
mongoose
  .connect(process.env.DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });

// Routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/products", productsRoute);
app.use("/api/v1/categories", categoriesRoute);
app.use("/api/v1/subCategories", subCategoriesRoute);
app.use("/api/v1/coupons", couponsRoute);
app.use("/api/v1/reviews", reviewsRoute);
app.get("/api/v1/allCategoriesPage", getAllCategories);
app.use("/api/v1/orders", ordersRoute);
app.use("/api/v1/cart", cartRoute);
app.get("/api/v1/adminStatistics", isAdmin, mainDashboardStatistics);
// Start server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
