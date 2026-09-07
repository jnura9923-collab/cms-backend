const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const { course_id } = req.query;
  const params = [];
  let sql = `SELECT l.*, c.name AS course_name FROM lms_materials l
             LEFT JOIN courses c ON c.id = l.course_id WHERE 1=1`;
  if (course_id) { sql += " AND l.course_id = ?"; params.push(course_id); }
  sql += " ORDER BY l.created_at DESC";
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// file_url should point to wherever you store the actual file
// (e.g. an S3 bucket, DigitalOcean Spaces, or your own /uploads folder served by Express).
router.post("/", authorize("admin", "staff", "teacher"), asyncHandler(async (req, res) => {
  const { title, course_id, type = "PDF", file_url } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const [result] = await pool.query(
    "INSERT INTO lms_materials (title, course_id, type, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?)",
    [title, course_id || null, type, file_url || null, req.user.id]
  );
  res.status(201).json({ id: result.insertId });
}));

router.delete("/:id", authorize("admin", "staff", "teacher"), asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM lms_materials WHERE id = ?", [req.params.id]);
  res.json({ message: "Material removed" });
}));

module.exports = router;
