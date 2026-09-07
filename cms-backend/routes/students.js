const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate);

// GET /api/students?search=&status=
router.get("/", asyncHandler(async (req, res) => {
  const { search = "", status } = req.query;
  const params = [`%${search}%`, `%${search}%`];
  let sql = `SELECT s.*, c.name AS course_name, b.name AS batch_name
             FROM students s
             LEFT JOIN courses c ON c.id = s.course_id
             LEFT JOIN batches b ON b.id = s.batch_id
             WHERE (s.name LIKE ? OR s.phone LIKE ?)`;
  if (status) { sql += " AND s.status = ?"; params.push(status); }
  sql += " ORDER BY s.created_at DESC";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// GET /api/students/me — the logged-in student's (or their parent's) own profile
router.get("/me", asyncHandler(async (req, res) => {
  let studentId;
  if (req.user.role === "student") {
    const [[row]] = await pool.query("SELECT id FROM students WHERE user_id = ?", [req.user.id]);
    studentId = row?.id;
  } else if (req.user.role === "parent") {
    const [[row]] = await pool.query(
      "SELECT student_id FROM parent_links WHERE user_id = ? LIMIT 1",
      [req.user.id]
    );
    studentId = row?.student_id;
  }
  if (!studentId) return res.status(404).json({ error: "No linked student profile found" });

  const [[student]] = await pool.query(
    `SELECT s.*, c.name AS course_name, b.name AS batch_name FROM students s
     LEFT JOIN courses c ON c.id = s.course_id
     LEFT JOIN batches b ON b.id = s.batch_id
     WHERE s.id = ?`,
    [studentId]
  );
  res.json(student);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Student not found" });
  res.json(rows[0]);
}));

router.post("/", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, phone, email, course_id, batch_id, join_date, status = "Active" } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });
  const [result] = await pool.query(
    `INSERT INTO students (name, phone, email, course_id, batch_id, join_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, phone, email || null, course_id || null, batch_id || null, join_date || null, status]
  );
  res.status(201).json({ id: result.insertId });
}));

router.put("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { name, phone, email, course_id, batch_id, join_date, status } = req.body;
  await pool.query(
    `UPDATE students SET name=?, phone=?, email=?, course_id=?, batch_id=?, join_date=?, status=? WHERE id=?`,
    [name, phone, email, course_id, batch_id, join_date, status, req.params.id]
  );
  res.json({ message: "Student updated" });
}));

router.delete("/:id", authorize("admin", "staff"), asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM students WHERE id = ?", [req.params.id]);
  res.json({ message: "Student deleted" });
}));

module.exports = router;
