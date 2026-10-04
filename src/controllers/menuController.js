const menuModel = require("../models/menuModel");

function parseId(value) {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    value = Number(value);
  }

  return Number.isSafeInteger(value) && value > 0 && value <= 2147483647
    ? value
    : null;
}

function validPrice(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 99999999.99 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}

function validStock(value) {
  return Number.isInteger(value) && value >= 0 && value <= 2147483647;
}

function validName(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 100
  );
}

function handleError(res, err) {
  console.error(err);

  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      error: "มีชื่อเมนูนี้ในสาขาแล้ว",
    });
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({
      error: "ไม่พบสาขาหรือหมวดหมู่ที่ระบุ",
    });
  }

  if (err.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(409).json({
      error: "ลบไม่ได้ เพราะเมนูนี้มีรายการสั่งซื้อหรือประวัติสต็อก",
    });
  }

  return res.status(500).json({
    error: "เกิดข้อผิดพลาดในการจัดการเมนู",
  });
}

// GET /api/menu?branchId=1
exports.listMenu = async (req, res) => {
  const branchId = parseId(req.query.branchId);

  if (!branchId) {
    return res.status(400).json({
      error: "ต้องระบุ branchId เป็นจำนวนเต็มมากกว่า 0",
    });
  }

  try {
    const rows = await menuModel.findAllByBranch(branchId);
    return res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
};

// GET /api/menu/1?branchId=1
exports.getMenuById = async (req, res) => {
  const branchId = parseId(req.query.branchId);
  const menuId = parseId(req.params.id);

  if (!branchId || !menuId) {
    return res.status(400).json({
      error: "ต้องระบุ menuId และ branchId ให้ถูกต้อง",
    });
  }

  try {
    const menu = await menuModel.findByIdAndBranch(menuId, branchId);

    if (!menu) {
      return res.status(404).json({
        error: "ไม่พบเมนูในสาขานี้",
      });
    }

    return res.json(menu);
  } catch (err) {
    return handleError(res, err);
  }
};

// POST /api/menu
exports.createMenu = async (req, res) => {
  const body = req.body || {};
  const branchId = parseId(body.branchId);
  const categoryId = parseId(body.categoryId);
  const { name, price } = body;
  const stockQuantity =
    body.stockQuantity === undefined ? 0 : body.stockQuantity;

  if (!branchId || !categoryId) {
    return res.status(400).json({
      error: "ต้องระบุ branchId และ categoryId ให้ถูกต้อง",
    });
  }

  if (!validName(name)) {
    return res.status(400).json({
      error: "ชื่อเมนูต้องมี 1–100 ตัวอักษร",
    });
  }

  if (!validPrice(price)) {
    return res.status(400).json({
      error: "ราคาต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    });
  }

  if (!validStock(stockQuantity)) {
    return res.status(400).json({
      error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป",
    });
  }

  try {
    const menuId = await menuModel.create(
      branchId,
      categoryId,
      name.trim(),
      price,
      stockQuantity,
    );

    return res.status(201).json({ menuId });
  } catch (err) {
    return handleError(res, err);
  }
};

// PUT /api/menu/1
exports.updateMenu = async (req, res) => {
  const body = req.body || {};
  const branchId = parseId(body.branchId);
  const menuId = parseId(req.params.id);
  const { name, price, stockQuantity } = body;

  if (!branchId || !menuId) {
    return res.status(400).json({
      error: "ต้องระบุ menuId และ branchId ให้ถูกต้อง",
    });
  }

  if (
    name === undefined &&
    price === undefined &&
    stockQuantity === undefined
  ) {
    return res.status(400).json({
      error: "ต้องส่ง name, price หรือ stockQuantity อย่างน้อย 1 ฟิลด์",
    });
  }

  if (name !== undefined && !validName(name)) {
    return res.status(400).json({
      error: "ชื่อเมนูต้องมี 1–100 ตัวอักษร",
    });
  }

  if (price !== undefined && !validPrice(price)) {
    return res.status(400).json({
      error: "ราคาต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    });
  }

  if (stockQuantity !== undefined && !validStock(stockQuantity)) {
    return res.status(400).json({
      error: "stockQuantity ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป",
    });
  }

  try {
    const affectedRows = await menuModel.updateFields(menuId, branchId, {
      name: name === undefined ? undefined : name.trim(),
      price,
      stockQuantity,
    });

    // ส่งค่าเดิมซ้ำก็ถือว่าแก้ไขสำเร็จ ถ้าเมนูยังมีอยู่
    if (affectedRows === 0) {
      const menu = await menuModel.findByIdAndBranch(menuId, branchId);

      if (!menu) {
        return res.status(404).json({
          error: "ไม่พบเมนูในสาขานี้",
        });
      }
    }

    return res.json({ updated: true });
  } catch (err) {
    return handleError(res, err);
  }
};

// DELETE /api/menu/1?branchId=1
exports.deleteMenu = async (req, res) => {
  const branchId = parseId(req.query.branchId);
  const menuId = parseId(req.params.id);

  if (!branchId || !menuId) {
    return res.status(400).json({
      error: "ต้องระบุ menuId และ branchId ให้ถูกต้อง",
    });
  }

  try {
    const affectedRows = await menuModel.remove(menuId, branchId);

    if (affectedRows === 0) {
      return res.status(404).json({
        error: "ไม่พบเมนูในสาขานี้",
      });
    }

    return res.json({ deleted: true });
  } catch (err) {
    return handleError(res, err);
  }
};
