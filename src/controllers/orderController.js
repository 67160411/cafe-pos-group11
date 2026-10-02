const orderModel = require("../models/orderModel");

exports.createOrder = async (req, res) => {
  try {
    const { branchId, employeeId, items, paymentMethod } = req.body;

    // ตรวจสอบ branchId
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(400).json({
        error: "branchId ไม่ถูกต้อง",
      });
    }

    // ตรวจสอบ employeeId
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return res.status(400).json({
        error: "employeeId ไม่ถูกต้อง",
      });
    }

    // ตรวจสอบ items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "items ต้องเป็น array และต้องมีอย่างน้อย 1 รายการ",
      });
    }

    // ตรวจสอบ paymentMethod
    const validPaymentMethods = ["cash", "qr", "card"];

    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: "paymentMethod ไม่ถูกต้อง",
      });
    }

    // ตรวจสอบสินค้า
    for (const item of items) {
      if (
        !Number.isInteger(item.menuId) ||
        item.menuId <= 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return res.status(400).json({
          error: "ข้อมูลสินค้าไม่ถูกต้อง",
        });
      }
    }

    const result = await orderModel.createOrder({
      branchId,
      employeeId,
      paymentMethod,
      items,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการสร้างออเดอร์",
    });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await orderModel.findAll();

    res.status(200).json(orders);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลออเดอร์",
    });
  }
};
