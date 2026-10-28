require("dotenv").config();

const path = require("path");
const express = require("express");
const app = express();

const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reportRoutes = require("./routes/reportRoutes");
const lookupRoutes = require("./routes/lookupRoutes");

app.use(express.json());
// หน้าจอ POS อยู่ในโฟลเดอร์ web/ ที่ root ของโปรเจกต์
app.use(express.static(path.join(__dirname, "..", "web")));

app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reports/sales", reportRoutes);
app.use("/api", lookupRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  return res.status(err.status || 500).json({
    error:
      err.status === 400
        ? "Invalid request body"
        : "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Cafe POS server running on port ${PORT}`);
});

