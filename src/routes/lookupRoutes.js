const express = require("express");
const router = express.Router();
const lookupController = require("../controllers/lookupController");

router.get("/branches", lookupController.listBranches);
router.get("/branches/:branch_id/employees", lookupController.listEmployees);
router.get("/categories", lookupController.listCategories);

module.exports = router;
