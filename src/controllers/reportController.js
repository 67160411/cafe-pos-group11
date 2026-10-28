const reportModel = require("../models/reportModel");
const parseId = require("../utils/parseId");

// GET /api/reports/sales?branchId=1
exports.getSalesReport = async (req, res) => {
  const branchId = parseId(req.query.branchId);

  if (!branchId) {
    return res.status(400).json({
      error: "ต้องระบุ branchId เป็นจำนวนเต็มมากกว่า 0",
    });
  }

  try {
    const rows = await reportModel.salesByMenu(branchId);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงรายงานยอดขาย",
    });
  }
};
