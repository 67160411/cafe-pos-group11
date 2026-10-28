const lookupModel = require("../models/lookupModel");
const parseId = require("../utils/parseId");

// GET /api/branches
exports.listBranches = async (req, res) => {
  try {
    return res.json(await lookupModel.findBranches());
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลสาขา",
    });
  }
};

// GET /api/branches/1/employees
exports.listEmployees = async (req, res) => {
  const branchId = parseId(req.params.branch_id);

  if (!branchId) {
    return res.status(400).json({
      error: "branch_id ต้องเป็นจำนวนเต็มมากกว่า 0",
    });
  }

  try {
    return res.json(await lookupModel.findEmployeesByBranch(branchId));
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลพนักงาน",
    });
  }
};

// GET /api/categories
exports.listCategories = async (req, res) => {
  try {
    return res.json(await lookupModel.findCategories());
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูลหมวดหมู่",
    });
  }
};
