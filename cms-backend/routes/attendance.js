const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate);

// GET /api/attendance?batch_id=&date=
router.get("/", asyncHandler(async (req, res) => {
  const { batch_id, date } = req.query;
  const params = [];
  let sql = `SELECT a.*, s.name AS student_name FROM attendance a
             JOIN students s ON s.id = a.student_id WHERE 1=1`;
  if (batch_id) { sql += " AND a.batch_id = ?"; params.push(batch_id); }
  if (date) { sql += " AND a.date = ?"; params.push(date); }
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// POST /api/attendance/mark  { batch_id, date, records: [{student_id, status}] }
router.post("/mark", authorize("admin", "staff", "teacher"), asyncHandler(async (req, res) => {
  const { batch_id, date, records } = req.body;
  if (!batch_id || !date || !Array.isArray(records)) {
    return res.status(400).json({ error: "batch_id, date and records[] are required" });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of records) {
      await conn.query(
        `INSERT INTO attendance (student_id, batch_id, date, status, marked_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by)`,
        [r.student_id, batch_id, date, r.status, req.user.id]
      );
    }
    await conn.commit();
    res.json({ message: `Attendance saved for ${records.length} student(s)` });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// GET /api/attendance/student/:id  — a student/parent's own attendance history
router.get("/student/:id", asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC LIMIT 90",
    [req.params.id]
  );
  res.json(rows);
}));

module.exports = router;
