require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const teacherRoutes = require("./routes/teachers");
const courseRoutes = require("./routes/courses");
const batchRoutes = require("./routes/batches");
const attendanceRoutes = require("./routes/attendance");
const examRoutes = require("./routes/exams");
const feeRoutes = require("./routes/fees");
const notificationRoutes = require("./routes/notifications");
const lmsRoutes = require("./routes/lms");
const payrollRoutes = require("./routes/payroll"); const setupRoutes = require("./routes/setup");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// Basic protection against brute-force login attempts.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use("/api/auth/login", loginLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/fees", feeRoutes);          // includes /api/fees/payment/ipn
app.use("/api/notifications", notificationRoutes);
app.use("/api/lms", lmsRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/setup-database", setupRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Centralised error handler — every asyncHandler-wrapped route lands here on failure.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`CMS API running on http://localhost:${PORT}`));
