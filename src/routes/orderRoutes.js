const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");

router.post("/", orderController.createOrder);

router.get("/:order_id", orderController.getOrderById);

router.get("/branch/:branch_id", orderController.getOrdersByBranch);

router.delete("/:order_id", orderController.deleteOrder);

module.exports = router;
