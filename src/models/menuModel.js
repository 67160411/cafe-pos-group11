const db = require("../config/db");

// ใช้ตอนสร้าง Order
exports.findManyForStockCheck = async (menuIds, branchId) => {
  if (menuIds.length === 0) return [];

  const [rows] = await db.query(
    `SELECT menu_id, price, stock_quantity
     FROM menu_item
     WHERE menu_id IN (?) AND branch_id = ?`,
    [menuIds, branchId],
  );

  return rows;
};

// ใช้คู่กับ orderController ตัวอย่างที่ตรวจสาขาแล้ว
exports.deductStock = async (menuId, quantity) => {
  const [result] = await db.query(
    `UPDATE menu_item
     SET stock_quantity = stock_quantity - ?
     WHERE menu_id = ? AND stock_quantity >= ?`,
    [quantity, menuId, quantity],
  );

  if (result.affectedRows === 0) {
    throw new Error("ไม่พบเมนูหรือสต็อกไม่เพียงพอ");
  }

  return result.affectedRows;
};

// ดูเมนูทั้งหมดของสาขา
exports.findAllByBranch = async (branchId) => {
  const [rows] = await db.query(
    `SELECT m.*, c.name AS category_name
     FROM menu_item m
     JOIN category c ON m.category_id = c.category_id
     WHERE m.branch_id = ?
     ORDER BY m.menu_id`,
    [branchId],
  );

  return rows;
};

// ดูเมนูตาม ID และสาขา
exports.findByIdAndBranch = async (menuId, branchId) => {
  const [rows] = await db.query(
    "SELECT * FROM menu_item WHERE menu_id = ? AND branch_id = ?",
    [menuId, branchId],
  );

  return rows[0];
};

// เพิ่มเมนู
exports.create = async (
  branchId,
  categoryId,
  name,
  price,
  stockQuantity = 0,
) => {
  const [result] = await db.query(
    `INSERT INTO menu_item
     (branch_id, category_id, name, price, stock_quantity)
     VALUES (?, ?, ?, ?, ?)`,
    [branchId, categoryId, name, price, stockQuantity],
  );

  return result.insertId;
};

// แก้ไขเฉพาะฟิลด์ที่ส่งมา
exports.updateFields = async (
  menuId,
  branchId,
  { name, price, stockQuantity },
) => {
  const [result] = await db.query(
    `UPDATE menu_item
     SET name = COALESCE(?, name),
         price = COALESCE(?, price),
         stock_quantity = COALESCE(?, stock_quantity)
     WHERE menu_id = ? AND branch_id = ?`,
    [name ?? null, price ?? null, stockQuantity ?? null, menuId, branchId],
  );

  return result.affectedRows;
};

// ลบเมนูเฉพาะสาขา
exports.remove = async (menuId, branchId) => {
  const [result] = await db.query(
    "DELETE FROM menu_item WHERE menu_id = ? AND branch_id = ?",
    [menuId, branchId],
  );

  return result.affectedRows;
};
