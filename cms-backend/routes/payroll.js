const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate, authorize("admin", "staff"));

// GET /api/payroll?month=2026-09  — generates rows on the fly for any teacher missing one
router.get("/", asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const [teachers] = await pool.query("SELECT * FROM teachers");

  for (const t of teachers) {
    await pool.query(
      `INSERT IGNORE INTO payroll (teacher_id, month, amount) VALUES (?, ?, ?)`,
      [t.id, month, t.salary]
    );
  }
  const [rows] = await pool.query(
    `SELECT p.*, t.name AS teacher_name, t.subject FROM payroll p
     JOIN teachers t ON t.id = p.teacher_id WHERE p.month = ?`,
    [month]
  );
  res.json(rows);
}));

router.post("/:id/pay", asyncHandler(async (req, res) => {
  await pool.query("UPDATE payroll SET status = 'Paid', paid_at = NOW() WHERE id = ?", [req.params.id]);
  res.json({ message: "Salary marked as paid" });
}));

module.exports = router;
