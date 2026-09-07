const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM courses ORDER BY created_at DESC");
  res.json(rows);
}));

router.post("/", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, duration, fee } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const [result] = await pool.query(
    "INSERT INTO courses (name, duration, fee) VALUES (?, ?, ?)",
    [name, duration || null, fee || 0]
  );
  res.status(201).json({ id: result.insertId });
}));

router.put("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, duration, fee } = req.body;
  await pool.query("UPDATE courses SET name=?, duration=?, fee=? WHERE id=?", [name, duration, fee, req.params.id]);
  res.json({ message: "Course updated" });
}));

router.delete("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM courses WHERE id = ?", [req.params.id]);
  res.json({ message: "Course deleted" });
}));

module.exports = router;
