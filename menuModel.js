const db = require("../config/db");

const MenuModel = {
  // fields: menu_id, branch_id, category_id, name, price, stock_quantity
  async findByBranch(branch_id) {
    const [rows] = await db.query(
      `SELECT m.*, c.name AS category_name
       FROM menu_item m JOIN category c ON m.category_id = c.category_id
       WHERE m.branch_id = ?`,
      [branch_id],
    );
    return rows;
  },
  async findById(menu_id) {
    const [rows] = await db.query("SELECT * FROM menu_item WHERE menu_id = ?", [
      menu_id,
    ]);
    return rows[0];
  },
  async create({ branch_id, category_id, name, price, stock_quantity = 0 }) {
    const [r] = await db.query(
      "INSERT INTO menu_item (branch_id, category_id, name, price, stock_quantity) VALUES (?,?,?,?,?)",
      [branch_id, category_id, name, price, stock_quantity],
    );
    return r.insertId;
  },
};
module.exports = MenuModel;
