const express = require("express");
const fs = require("fs");
const path = require("path");
const pool = require("../config/db");

const router = express.Router();

router.get("/", async (req, res) => {
  if (!process.env.SETUP_KEY || req.query.key !== process.env.SETUP_KEY) {
    return res.status(403).json({ error: "Forbidden — missing or wrong key" });
  }

  const schemaPath = path.join(__dirname, "..", "database", "schema-no-create.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const results = [];
  for (const statement of statements) {
    try {
      await pool.query(statement);
      results.push({ ok: true, statement: statement.slice(0, 60) });
    } catch (err) {
      results.push({ ok: false, statement: statement.slice(0, 60), error: err.message });
    }
  }

  res.json({ message: "Database setup finished", results });
});

module.exports = router;