const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT e.*, c.name AS course_name FROM exams e
     LEFT JOIN courses c ON c.id = e.course_id ORDER BY e.exam_date DESC`
  );
  res.json(rows);
}));

router.post("/", authorize("admin", "staff", "teacher"), asyncHandler(async (req, res) => {
  const { name, course_id, exam_date, max_marks = 100 } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const [result] = await pool.query(
    "INSERT INTO exams (name, course_id, exam_date, max_marks) VALUES (?, ?, ?, ?)",
    [name, course_id || null, exam_date || null, max_marks]
  );
  res.status(201).json({ id: result.insertId });
}));

// GET /api/exams/:id/results
router.get("/:id/results", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*, s.name AS student_name FROM results r
     JOIN students s ON s.id = r.student_id WHERE r.exam_id = ?`,
    [req.params.id]
  );
  res.json(rows);
}));

// POST /api/exams/:id/results  { student_id, marks }
router.post("/:id/results", authorize("admin", "staff", "teacher"), asyncHandler(async (req, res) => {
  const { student_id, marks } = req.body;
  if (!student_id || marks === undefined) return res.status(400).json({ error: "student_id and marks are required" });
  await pool.query(
    `INSERT INTO results (exam_id, student_id, marks) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE marks = VALUES(marks)`,
    [req.params.id, student_id, marks]
  );
  res.status(201).json({ message: "Result saved" });
}));

// GET /api/exams/student/:id — a student/parent's own results
router.get("/student/:id", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.marks, e.name AS exam_name, e.max_marks, e.exam_date FROM results r
     JOIN exams e ON e.id = r.exam_id WHERE r.student_id = ? ORDER BY e.exam_date DESC`,
    [req.params.id]
  );
  res.json(rows);
}));

module.exports = router;
