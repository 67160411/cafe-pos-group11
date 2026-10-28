const menuModel = require("../models/menuModel");
const parseId = require("../utils/parseId");

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
      error: "A menu item with this name already exists in this branch",
    });
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({
      error: "Branch or category not found",
    });
  }

  if (err.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(409).json({
      error: "Cannot delete: this menu item has order or stock history",
    });
  }

  return res.status(500).json({
    error: "Failed to process menu request",
  });
}

// GET /api/menu?branchId=1
exports.listMenu = async (req, res) => {
  const branchId = parseId(req.query.branchId);

  if (!branchId) {
    return res.status(400).json({
      error: "branchId is required and must be a positive integer",
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
      error: "A valid menuId and branchId are required",
    });
  }

  try {
    const menu = await menuModel.findByIdAndBranch(menuId, branchId);

    if (!menu) {
      return res.status(404).json({
        error: "Menu item not found in this branch",
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
      error: "A valid branchId and categoryId are required",
    });
  }

  if (!validName(name)) {
    return res.status(400).json({
      error: "Name must be 1–100 characters",
    });
  }

  if (!validPrice(price)) {
    return res.status(400).json({
      error: "Price must be greater than 0 with at most 2 decimal places",
    });
  }

  if (!validStock(stockQuantity)) {
    return res.status(400).json({
      error: "stockQuantity must be an integer of 0 or more",
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
  const categoryId =
    body.categoryId === undefined ? undefined : parseId(body.categoryId);

  if (!branchId || !menuId) {
    return res.status(400).json({
      error: "A valid menuId and branchId are required",
    });
  }

  if (
    categoryId === undefined &&
    name === undefined &&
    price === undefined &&
    stockQuantity === undefined
  ) {
    return res.status(400).json({
      error:
        "Provide at least one of categoryId, name, price or stockQuantity",
    });
  }

  if (categoryId === null) {
    return res.status(400).json({
      error: "categoryId must be a positive integer",
    });
  }

  if (name !== undefined && !validName(name)) {
    return res.status(400).json({
      error: "Name must be 1–100 characters",
    });
  }

  if (price !== undefined && !validPrice(price)) {
    return res.status(400).json({
      error: "Price must be greater than 0 with at most 2 decimal places",
    });
  }

  if (stockQuantity !== undefined && !validStock(stockQuantity)) {
    return res.status(400).json({
      error: "stockQuantity must be an integer of 0 or more",
    });
  }

  try {
    const affectedRows = await menuModel.updateFields(menuId, branchId, {
      categoryId,
      name: name === undefined ? undefined : name.trim(),
      price,
      stockQuantity,
    });

    // ส่งค่าเดิมซ้ำก็ถือว่าแก้ไขสำเร็จ ถ้าเมนูยังมีอยู่
    if (affectedRows === 0) {
      const menu = await menuModel.findByIdAndBranch(menuId, branchId);

      if (!menu) {
        return res.status(404).json({
          error: "Menu item not found in this branch",
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
      error: "A valid menuId and branchId are required",
    });
  }

  try {
    const affectedRows = await menuModel.remove(menuId, branchId);

    if (affectedRows === 0) {
      return res.status(404).json({
        error: "Menu item not found in this branch",
      });
    }

    return res.json({ deleted: true });
  } catch (err) {
    return handleError(res, err);
  }
};
