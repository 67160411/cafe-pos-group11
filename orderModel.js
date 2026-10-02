const db = require("../config/db");

const OrderModel = {
  async create({ branch_id, employee_id, payment_method, items }) {
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      const [o] = await conn.query(
        `INSERT INTO orders
         (branch_id, employee_id, payment_method)
         VALUES (?, ?, ?)`,
        [branch_id, employee_id, payment_method],
      );

      for (const it of items) {
        const [[menu]] = await conn.query(
          `SELECT price, stock_quantity
           FROM menu_item
           WHERE menu_id = ?
           AND branch_id = ?
           FOR UPDATE`,
          [it.menu_id, branch_id],
        );

        if (!menu) {
          throw new Error(`ไม่พบเมนู ${it.menu_id} ในสาขานี้`);
        }

        if (menu.stock_quantity < it.quantity) {
          throw new Error(`สต็อกไม่พอสำหรับเมนู ${it.menu_id}`);
        }

        await conn.query(
          `INSERT INTO order_item
           (order_id, menu_id, quantity, unit_price)
           VALUES (?, ?, ?, ?)`,
          [o.insertId, it.menu_id, it.quantity, menu.price],
        );

        await conn.query(
          `UPDATE menu_item
           SET stock_quantity = stock_quantity - ?
           WHERE menu_id = ?`,
          [it.quantity, it.menu_id],
        );

        await conn.query(
          `INSERT INTO stock_movement
           (menu_id, quantity_change)
           VALUES (?, ?)`,
          [it.menu_id, -it.quantity],
        );
      }

      await conn.commit();

      return o.insertId;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  async findById(order_id) {
    const [orders] = await db.query("SELECT * FROM orders WHERE order_id = ?", [
      order_id,
    ]);

    if (!orders[0]) return null;

    const [items] = await db.query(
      `SELECT
        oi.order_item_id,
        oi.order_id,
        oi.menu_id,
        m.name AS menu_name,
        oi.quantity,
        oi.unit_price,
        oi.quantity * oi.unit_price AS subtotal
       FROM order_item oi
       JOIN menu_item m
         ON oi.menu_id = m.menu_id
       WHERE oi.order_id = ?`,
      [order_id],
    );

    const total = items.reduce((sum, i) => sum + Number(i.subtotal), 0);

    return {
      ...orders[0],
      items,
      total,
    };
  },

  async findByBranch(branch_id) {
    const [rows] = await db.query(
      `SELECT
        o.*,
        SUM(oi.quantity * oi.unit_price) AS total
       FROM orders o
       LEFT JOIN order_item oi
         ON o.order_id = oi.order_id
       WHERE o.branch_id = ?
       GROUP BY o.order_id
       ORDER BY o.created_at DESC`,
      [branch_id],
    );

    return rows;
  },

  async remove(order_id) {
    await db.query("DELETE FROM orders WHERE order_id = ?", [order_id]);
  },
};

module.exports = OrderModel;
