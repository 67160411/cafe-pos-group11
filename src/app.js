require("dotenv").config();

const express = require("express");
const app = express();

const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");

app.use(express.json());
app.use(express.static("public"));

app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  return res.status(err.status || 500).json({
    error:
      err.status === 400
        ? "รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง"
        : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Cafe POS server running on port ${PORT}`);
});
