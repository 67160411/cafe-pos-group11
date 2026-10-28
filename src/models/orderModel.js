const db = require("../config/db");
const { Order, OrderItem } = require("./Order");
const { isLowStock } = require("./menuModel");

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function transaction(action) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    const result = await action(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

exports.createOrder = async ({
  branchId,
  employeeId,
  paymentMethod,
  items,
}) => {
  // รวมจำนวนเมนูซ้ำก่อนตรวจสต็อก
  const quantities = new Map();

  for (const item of items) {
    const quantity = (quantities.get(item.menuId) || 0) + item.quantity;

    if (!Number.isSafeInteger(quantity) || quantity > 2147483647) {
      throw httpError(400, "Quantity is too large");
    }

    quantities.set(item.menuId, quantity);
  }

  // เรียง ID เพื่อให้ลำดับล็อกเมนูสม่ำเสมอ
  const entries = [...quantities.entries()].sort((a, b) => a[0] - b[0]);

  return transaction(async (conn) => {
    // ตรวจพนักงานว่าอยู่ในสาขาที่ระบุ
    const [employees] = await conn.query(
      `SELECT employee_id
       FROM employee
       WHERE employee_id = ? AND branch_id = ?
       FOR UPDATE`,
      [employeeId, branchId],
    );

    if (employees.length === 0) {
      throw httpError(400, "Employee not found in this branch");
    }

    const menus = new Map();

    // ตรวจและล็อกสต็อกก่อนบันทึกรายการ
    for (const [menuId, quantity] of entries) {
      const [rows] = await conn.query(
        `SELECT menu_id, name, price, stock_quantity
         FROM menu_item
         WHERE menu_id = ? AND branch_id = ?
         FOR UPDATE`,
        [menuId, branchId],
      );

      const menu = rows[0];

      if (!menu) {
        throw httpError(400, `Menu item ${menuId} not found in this branch`);
      }

      if (menu.stock_quantity < quantity) {
        throw httpError(
          400,
          `Insufficient stock for ${menu.name} (${menu.stock_quantity} left)`,
        );
      }

      menus.set(menuId, menu);
    }

    const [order] = await conn.query(
      `INSERT INTO orders
       (branch_id, employee_id, payment_method)
       VALUES (?, ?, ?)`,
      [branchId, employeeId, paymentMethod],
    );

    const orderId = order.insertId;
    const receipt = new Order(orderId, branchId, employeeId, paymentMethod);
    const lowStockMenuIds = [];

    for (const [menuId, quantity] of entries) {
      const menu = menus.get(menuId);
      receipt.addItem(new OrderItem(menuId, quantity, menu.price));

      // ใช้ราคาจากฐานข้อมูล
      await conn.query(
        `INSERT INTO order_item
         (order_id, menu_id, quantity, unit_price)
         VALUES (?, ?, ?, ?)`,
        [orderId, menuId, quantity, menu.price],
      );

      const [stockResult] = await conn.query(
        `UPDATE menu_item
         SET stock_quantity = stock_quantity - ?
         WHERE menu_id = ?
           AND branch_id = ?
           AND stock_quantity >= ?`,
        [quantity, menuId, branchId, quantity],
      );

      if (stockResult.affectedRows === 0) {
        throw httpError(409, "Stock changed, please try again");
      }

      await conn.query(
        `INSERT INTO stock_movement
         (menu_id, quantity_change)
         VALUES (?, ?)`,
        [menuId, -quantity],
      );

      if (isLowStock(menu.stock_quantity - quantity)) {
        lowStockMenuIds.push(menuId);
      }
    }

    return {
      orderId,
      totalAmount: receipt.calculateTotal(),
      lowStockMenuIds,
    };
  });
};

exports.findById = async (orderId, branchId) => {
  const [orders] = await db.query(
    `SELECT *
     FROM orders
     WHERE order_id = ? AND branch_id = ?`,
    [orderId, branchId],
  );

  if (!orders[0]) return null;

  const [items] = await db.query(
    `SELECT
       oi.menu_id,
       m.name AS menu_name,
       oi.quantity,
       oi.unit_price
     FROM order_item oi
     JOIN menu_item m ON m.menu_id = oi.menu_id
     WHERE oi.order_id = ?`,
    [orderId],
  );

  const order = toOrder(orders[0]);
  const receipt = new Order(
    order.orderId,
    order.branchId,
    order.employeeId,
    order.paymentMethod,
  );

  for (const item of items) {
    receipt.addItem(
      new OrderItem(item.menu_id, item.quantity, item.unit_price, item.menu_name),
    );
  }

  return {
    ...order,
    items: receipt.items.map((item) => ({
      ...item,
      subtotal: Math.round(item.calculateSubtotal() * 100) / 100,
    })),
    totalAmount: receipt.calculateTotal(),
  };
};

// DB ใช้ snake_case แต่ JSON ใช้ camelCase
function toOrder(row) {
  return {
    orderId: row.order_id,
    branchId: row.branch_id,
    employeeId: row.employee_id,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
  };
}

exports.findByBranch = async (branchId) => {
  const [rows] = await db.query(
    `SELECT
       o.*,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total
     FROM orders o
     LEFT JOIN order_item oi ON oi.order_id = o.order_id
     WHERE o.branch_id = ?
     GROUP BY o.order_id
     ORDER BY o.created_at DESC, o.order_id DESC`,
    [branchId],
  );

  // SUM ได้ DECIMAL ซึ่ง mysql2 ส่งกลับเป็น string
  return rows.map((row) => ({
    ...toOrder(row),
    totalAmount: Number(row.total),
  }));
};

// ยกเลิก Order พร้อมคืนสต็อก
exports.remove = async (orderId, branchId) => {
  return transaction(async (conn) => {
    const [orders] = await conn.query(
      `SELECT order_id
       FROM orders
       WHERE order_id = ? AND branch_id = ?
       FOR UPDATE`,
      [orderId, branchId],
    );

    if (orders.length === 0) return 0;

    const [items] = await conn.query(
      `SELECT menu_id, SUM(quantity) AS quantity
       FROM order_item
       WHERE order_id = ?
       GROUP BY menu_id
       ORDER BY menu_id`,
      [orderId],
    );

    for (const item of items) {
      const [menus] = await conn.query(
        `SELECT menu_id
         FROM menu_item
         WHERE menu_id = ? AND branch_id = ?
         FOR UPDATE`,
        [item.menu_id, branchId],
      );

      if (menus.length === 0) {
        throw httpError(409, "Menu item and branch do not match");
      }

      await conn.query(
        `UPDATE menu_item
         SET stock_quantity = stock_quantity + ?
         WHERE menu_id = ? AND branch_id = ?`,
        [item.quantity, item.menu_id, branchId],
      );

      await conn.query(
        `INSERT INTO stock_movement
         (menu_id, quantity_change)
         VALUES (?, ?)`,
        [item.menu_id, item.quantity],
      );
    }

    // ลบ order_item ด้วย ON DELETE CASCADE ใน schema เดิม
    const [result] = await conn.query(
      `DELETE FROM orders
       WHERE order_id = ? AND branch_id = ?`,
      [orderId, branchId],
    );

    return result.affectedRows;
  });
};
