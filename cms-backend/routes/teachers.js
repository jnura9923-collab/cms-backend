const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM teachers ORDER BY created_at DESC");
  res.json(rows);
}));

router.post("/", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, subject, phone, email, salary = 0 } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const [result] = await pool.query(
    "INSERT INTO teachers (name, subject, phone, email, salary) VALUES (?, ?, ?, ?, ?)",
    [name, subject || null, phone || null, email || null, salary]
  );
  res.status(201).json({ id: result.insertId });
}));

router.put("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, subject, phone, email, salary } = req.body;
  await pool.query(
    "UPDATE teachers SET name=?, subject=?, phone=?, email=?, salary=? WHERE id=?",
    [name, subject, phone, email, salary, req.params.id]
  );
  res.json({ message: "Teacher updated" });
}));

router.delete("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM teachers WHERE id = ?", [req.params.id]);
  res.json({ message: "Teacher deleted" });
}));

module.exports = router;
