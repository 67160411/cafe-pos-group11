const orderModel = require("../models/orderModel");
const parsePositiveId = require("../utils/parseId");

exports.createOrder = async (req, res) => {
  try {
    const { branchId, employeeId, items, paymentMethod } = req.body || {};

    if (
      !Number.isSafeInteger(branchId) ||
      branchId <= 0 ||
      branchId > 2147483647
    ) {
      return res.status(400).json({
        error: "Invalid branchId",
      });
    }

    if (
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0 ||
      employeeId > 2147483647
    ) {
      return res.status(400).json({
        error: "Invalid employeeId",
      });
    }

    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return res.status(400).json({
        error: "items must contain 1–100 entries",
      });
    }

    if (!["cash", "qr", "card"].includes(paymentMethod)) {
      return res.status(400).json({
        error: "paymentMethod must be cash, qr or card",
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
          error: "menuId and quantity must be positive integers",
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
      console.warn("Low stock menu_id:", result.lowStockMenuIds);
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
          ? "Failed to create order"
          : status === 409 && !err.status
            ? "Data was modified concurrently, please try again"
            : err.message,
    });
  }
};


// GET /api/orders/:order_id?branchId=1
exports.getOrderById = async (req, res) => {
  const orderId = parsePositiveId(req.params.order_id);
  const branchId = parsePositiveId(req.query.branchId);

  if (!orderId || !branchId) {
    return res.status(400).json({
      error: "A valid order_id and branchId are required",
    });
  }

  try {
    const order = await orderModel.findById(orderId, branchId);

    if (!order) {
      return res.status(404).json({
        error: "Order not found in this branch",
      });
    }

    return res.json(order);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to load order",
    });
  }
};

// GET /api/orders/branch/:branch_id
exports.getOrdersByBranch = async (req, res) => {
  const branchId = parsePositiveId(req.params.branch_id);

  if (!branchId) {
    return res.status(400).json({
      error: "branch_id must be a positive integer",
    });
  }

  try {
    const orders = await orderModel.findByBranch(branchId);
    return res.json(orders);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to load branch orders",
    });
  }
};

// DELETE /api/orders/:order_id?branchId=1
exports.deleteOrder = async (req, res) => {
  const orderId = parsePositiveId(req.params.order_id);
  const branchId = parsePositiveId(req.query.branchId);

  if (!orderId || !branchId) {
    return res.status(400).json({
      error: "A valid order_id and branchId are required",
    });
  }

  try {
    const affectedRows = await orderModel.remove(orderId, branchId);

    if (affectedRows === 0) {
      return res.status(404).json({
        error: "Order not found in this branch",
      });
    }

    return res.json({
      deleted: true,
      orderId,
    });
  } catch (err) {
    console.error(err);

    return res.status(err.status || 500).json({
      error:
        err.status
          ? err.message
          : "Failed to cancel order",
    });
  }
};

