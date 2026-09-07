const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const { sendEmail } = require("../utils/mailer");
const { sendSMS } = require("../utils/sms");

const router = express.Router();
router.use(authenticate);

router.get("/", asyncHandler(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100");
  res.json(rows);
}));

// Resolve an audience string ('all_students' | 'all_parents' | 'all_teachers' | a batch name)
// into a list of { name, email, phone } recipients.
async function resolveRecipients(audience) {
  if (audience === "all_students") {
    const [rows] = await pool.query("SELECT name, email, phone FROM students WHERE status = 'Active'");
    return rows;
  }
  if (audience === "all_teachers") {
    const [rows] = await pool.query("SELECT name, email, phone FROM teachers");
    return rows;
  }
  if (audience === "all_parents") {
    const [rows] = await pool.query(
      `SELECT u.name, u.email, u.phone FROM users u WHERE u.role = 'parent'`
    );
    return rows;
  }
  // otherwise treat it as a batch name
  const [rows] = await pool.query(
    `SELECT s.name, s.email, s.phone FROM students s
     JOIN batches b ON b.id = s.batch_id WHERE b.name = ? AND s.status = 'Active'`,
    [audience]
  );
  return rows;
}

// POST /api/notifications  { title, message, audience, channel: ['app','email','sms'] }
router.post("/", authorize("admin", "staff", "teacher"), asyncHandler(async (req, res) => {
  const { title, message, audience, channel = ["app"] } = req.body;
  if (!title || !message || !audience) return res.status(400).json({ error: "title, message and audience are required" });

  const [result] = await pool.query(
    "INSERT INTO notifications (title, message, audience, channel, created_by) VALUES (?, ?, ?, ?, ?)",
    [title, message, audience, channel.join(","), req.user.id]
  );

  const recipients = await resolveRecipients(audience);
  const results = { email: 0, sms: 0 };

  if (channel.includes("email")) {
    for (const r of recipients) {
      if (r.email) { await sendEmail(r.email, title, message); results.email++; }
    }
  }
  if (channel.includes("sms")) {
    for (const r of recipients) {
      if (r.phone) { await sendSMS(r.phone, `${title}: ${message}`); results.sms++; }
    }
  }

  res.status(201).json({ id: result.insertId, recipients: recipients.length, sent: results });
}));

module.exports = router;
