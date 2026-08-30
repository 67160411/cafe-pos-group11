const orderModel = require("../models/orderModel");

exports.createOrder = async (req, res) => {
  try {
    const { items, paymentMethod } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "items ต้องเป็น array และต้องมีอย่างน้อย 1 รายการ",
      });
    }

    const validPaymentMethods = ["cash", "qr", "card"];

    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        error: "paymentMethod ไม่ถูกต้อง",
      });
    }

    for (const item of items) {
      if (
        !item.name ||
        typeof item.name !== "string" ||
        !Number.isFinite(Number(item.price)) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return res.status(400).json({
          error: "ข้อมูลสินค้าไม่ถูกต้อง",
        });
      }
    }

    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0,
    );

    const orderId = await orderModel.create(paymentMethod, totalAmount);

    res.status(201).json({
      orderId,
      totalAmount,
    });
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
