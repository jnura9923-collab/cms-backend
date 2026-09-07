const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, c.name AS course_name, t.name AS teacher_name
     FROM batches b
     LEFT JOIN courses c ON c.id = b.course_id
     LEFT JOIN teachers t ON t.id = b.teacher_id
     ORDER BY b.created_at DESC`
  );
  res.json(rows);
}));

router.post("/", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, course_id, teacher_id, schedule, seats = 30 } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const [result] = await pool.query(
    "INSERT INTO batches (name, course_id, teacher_id, schedule, seats) VALUES (?, ?, ?, ?, ?)",
    [name, course_id || null, teacher_id || null, schedule || null, seats]
  );
  res.status(201).json({ id: result.insertId });
}));

router.put("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, course_id, teacher_id, schedule, seats } = req.body;
  await pool.query(
    "UPDATE batches SET name=?, course_id=?, teacher_id=?, schedule=?, seats=? WHERE id=?",
    [name, course_id, teacher_id, schedule, seats, req.params.id]
  );
  res.json({ message: "Batch updated" });
}));

router.delete("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM batches WHERE id = ?", [req.params.id]);
  res.json({ message: "Batch deleted" });
}));

module.exports = router;
