const db = require("../config/db");

// ข้อมูลอ้างอิงสำหรับหน้าจอ POS (เลือกสาขา พนักงาน และหมวดหมู่)
exports.findBranches = async () => {
  const [rows] = await db.query(
    `SELECT branch_id AS branchId, name, address
     FROM branch
     ORDER BY branch_id`,
  );

  return rows;
};

exports.findEmployeesByBranch = async (branchId) => {
  const [rows] = await db.query(
    `SELECT employee_id AS employeeId, branch_id AS branchId, name, role
     FROM employee
     WHERE branch_id = ?
     ORDER BY employee_id`,
    [branchId],
  );

  return rows;
};

exports.findCategories = async () => {
  const [rows] = await db.query(
    `SELECT category_id AS categoryId, name
     FROM category
     ORDER BY category_id`,
  );

  return rows;
};
