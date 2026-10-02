require("dotenv").config();

const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

const orderRoutes = require("./routes/orderRoutes");
app.use("/api/orders", orderRoutes);

const PORT = process.env.PORT || 3000;
const orderRoutes = require("./routes/orderRoutes");

app.use("/api/orders", orderRoutes);

app.listen(PORT, () => {
  console.log(`Cafe POS server running on port ${PORT}`);
});
