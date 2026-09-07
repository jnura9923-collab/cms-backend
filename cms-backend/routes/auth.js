const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid email or password" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid email or password" });
  if (user.status !== "active") return res.status(403).json({ error: "This account has been deactivated" });

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// POST /api/auth/register  (admin/staff creates a login for a teacher/student/parent)
router.post("/register", authenticate, authorize("admin", "staff"), async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  if (!name || !password || !role) return res.status(400).json({ error: "name, password and role are required" });

  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)",
      [name, email || null, phone || null, hash, role]
    );
    res.status(201).json({ id: result.insertId, name, email, phone, role });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Email or phone already registered" });
    throw err;
  }
});

// One-time bootstrap route to create the very first admin account.
// Disable or remove this route once your first admin exists.
router.post("/register-admin", async (req, res) => {
  const [existing] = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
  if (existing[0].c > 0) return res.status(403).json({ error: "An admin already exists. Ask them to create your account." });

  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: "name, email and password are required" });

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
    [name, email, phone || null, hash]
  );
  res.status(201).json({ id: result.insertId, name, email, role: "admin" });
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  const [rows] = await pool.query("SELECT id, name, email, phone, role, status FROM users WHERE id = ?", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

// POST /api/auth/change-password
router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.user.id]);
  const user = rows[0];
  const ok = await bcrypt.compare(currentPassword, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id]);
  res.json({ message: "Password updated" });
});

module.exports = router;
