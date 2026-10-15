
const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");

// สร้างออเดอร์
router.post("/", orderController.createOrder);

// ดูออเดอร์ทั้งหมดของสาขา
// ต้องอยู่ก่อน /:order_id
router.get("/branch/:branch_id", orderController.getOrdersByBranch);

// ดูออเดอร์รายรายการ
router.get("/:order_id", orderController.getOrderById);

// ยกเลิกออเดอร์และคืนสต็อก
router.delete("/:order_id", orderController.deleteOrder);

module.exports = router;
