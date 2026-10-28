const db = require("../config/db");

// สรุปยอดขายรวมต่อเมนูของสาขาที่เลือก
exports.salesByMenu = async (branchId) => {
  const [rows] = await db.query(
    `SELECT m.menu_id AS menuId,
            m.name,
            SUM(oi.quantity) AS totalQuantity,
            SUM(oi.quantity * oi.unit_price) AS totalSales
     FROM order_item oi
     JOIN orders o ON oi.order_id = o.order_id
     JOIN menu_item m ON oi.menu_id = m.menu_id
     WHERE o.branch_id = ?
     GROUP BY m.menu_id, m.name
     ORDER BY totalSales DESC, m.menu_id`,
    [branchId],
  );

  // SUM ได้ DECIMAL ซึ่ง mysql2 ส่งกลับเป็น string จึงแปลงเป็น number ที่ backend
  return rows.map((row) => ({
    menuId: row.menuId,
    name: row.name,
    totalQuantity: Number(row.totalQuantity),
    totalSales: Number(row.totalSales),
  }));
};
