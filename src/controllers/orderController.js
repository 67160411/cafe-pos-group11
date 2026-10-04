const orderModel = require("../models/orderModel");
exports.createOrder = async (req, res) => {
  try {
    const { branchId, employeeId, items, paymentMethod } = req.body || {};

    if (
      !Number.isSafeInteger(branchId) ||
      branchId <= 0 ||
      branchId > 2147483647
    ) {
      return res.status(400).json({
        error: "branchId ไม่ถูกต้อง",
      });
    }

    if (
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0 ||
      employeeId > 2147483647
    ) {
      return res.status(400).json({
        error: "employeeId ไม่ถูกต้อง",
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return res.status(400).json({
        error: "items ต้องมี 1–100 รายการ",
      });
    }

    if (!["cash", "qr", "card"].includes(paymentMethod)) {
      return res.status(400).json({
        error: "paymentMethod ต้องเป็น cash, qr หรือ card",
      });
    }

    for (const item of items) {
      if (
        !item ||
        !Number.isSafeInteger(item.menuId) ||
        item.menuId <= 0 ||
        item.menuId > 2147483647 ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 2147483647
      ) {
        return res.status(400).json({
          error: "menuId และ quantity ต้องเป็นจำนวนเต็มมากกว่า 0",
        });
      }
    }

    // Model จัดการ Order, รายการ และสต็อกใน transaction เดียว
    const result = await orderModel.createOrder({
      branchId,
      employeeId,
      paymentMethod,
      items,
    });

    if (result.lowStockMenuIds.length > 0) {
      console.warn("สต็อกใกล้หมด menu_id:", result.lowStockMenuIds);
    }

    return res.status(201).json(result);
  } catch (err) {
    console.error(err);

    const status =
      err.status ||
      (err.code === "ER_LOCK_DEADLOCK" || err.code === "ER_LOCK_WAIT_TIMEOUT"
        ? 409
        : 500);

    return res.status(status).json({
      error:
        status === 500
          ? "เกิดข้อผิดพลาดในการสร้างออเดอร์"
          : status === 409 && !err.status
            ? "มีการแก้ไขข้อมูลพร้อมกัน กรุณาลองใหม่"
            : err.message,
    });
  }
};
