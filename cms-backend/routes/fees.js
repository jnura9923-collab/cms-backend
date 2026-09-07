const express = require("express");
const pool = require("../config/db");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");
const { initPayment, validateTransaction } = require("../utils/payment");

const router = express.Router();

function statusFor(total, paid) {
  if (paid <= 0) return "Unpaid";
  if (paid >= total) return "Paid";
  return "Partial";
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT f.*, s.name AS student_name, c.name AS course_name FROM fees f
     JOIN students s ON s.id = f.student_id
     LEFT JOIN courses c ON c.id = f.course_id
     ORDER BY f.due_date ASC`
  );
  res.json(rows);
}));

router.post("/", authenticate, authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { student_id, course_id, total, due_date } = req.body;
  if (!student_id || !total) return res.status(400).json({ error: "student_id and total are required" });
  const [result] = await pool.query(
    "INSERT INTO fees (student_id, course_id, total, due_date) VALUES (?, ?, ?, ?)",
    [student_id, course_id || null, total, due_date || null]
  );
  res.status(201).json({ id: result.insertId });
}));

// Manual (cash / bkash-by-hand) payment recorded by staff at the front desk.
router.post("/:id/pay", authenticate, authorize("admin", "staff"), asyncHandler(async (req, res) => {
  const { amount, method = "cash" } = req.body;
  const [[fee]] = await pool.query("SELECT * FROM fees WHERE id = ?", [req.params.id]);
  if (!fee) return res.status(404).json({ error: "Fee record not found" });

  const newPaid = Math.min(Number(fee.total), Number(fee.paid) + Number(amount));
  await pool.query("UPDATE fees SET paid = ?, status = ? WHERE id = ?", [newPaid, statusFor(fee.total, newPaid), req.params.id]);
  await pool.query(
    "INSERT INTO fee_payments (fee_id, amount, method, status) VALUES (?, ?, ?, 'success')",
    [req.params.id, amount, method]
  );
  res.json({ message: "Payment recorded", paid: newPaid });
}));

// Start an online payment session (SSLCommerz) — called by the student/parent app.
router.post("/:id/pay/online", authenticate, asyncHandler(async (req, res) => {
  const [[fee]] = await pool.query(
    `SELECT f.*, s.name AS student_name, s.email AS student_email, s.phone AS student_phone
     FROM fees f JOIN students s ON s.id = f.student_id WHERE f.id = ?`,
    [req.params.id]
  );
  if (!fee) return res.status(404).json({ error: "Fee record not found" });

  const due = Number(fee.total) - Number(fee.paid);
  const amount = req.body.amount ? Math.min(due, Number(req.body.amount)) : due;
  if (amount <= 0) return res.status(400).json({ error: "This fee is already fully paid" });

  const { gatewayUrl, tranId } = await initPayment({
    amount,
    feeId: fee.id,
    studentName: fee.student_name,
    studentEmail: fee.student_email,
    studentPhone: fee.student_phone,
  });

  await pool.query(
    "INSERT INTO fee_payments (fee_id, amount, method, transaction_id, status) VALUES (?, ?, 'sslcommerz', ?, 'pending')",
    [fee.id, amount, tranId]
  );

  res.json({ gatewayUrl });
}));

// SSLCommerz redirects here after payment (configured as success_url).
// It sends val_id + tran_id as form fields.
router.post("/payment/ipn", express.urlencoded({ extended: true }), asyncHandler(async (req, res) => {
  const { val_id, tran_id } = req.body;
  const isValid = await validateTransaction(val_id);

  const [[payment]] = await pool.query("SELECT * FROM fee_payments WHERE transaction_id = ?", [tran_id]);
  if (!payment) return res.redirect(process.env.FRONTEND_FAIL_URL);

  if (!isValid) {
    await pool.query("UPDATE fee_payments SET status = 'failed' WHERE id = ?", [payment.id]);
    return res.redirect(process.env.FRONTEND_FAIL_URL);
  }

  await pool.query("UPDATE fee_payments SET status = 'success' WHERE id = ?", [payment.id]);
  const [[fee]] = await pool.query("SELECT * FROM fees WHERE id = ?", [payment.fee_id]);
  const newPaid = Math.min(Number(fee.total), Number(fee.paid) + Number(payment.amount));
  await pool.query("UPDATE fees SET paid = ?, status = ? WHERE id = ?", [newPaid, statusFor(fee.total, newPaid), fee.id]);

  res.redirect(process.env.FRONTEND_SUCCESS_URL);
}));

// A student/parent's own fee record.
router.get("/student/:id", authenticate, asyncHandler(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM fees WHERE student_id = ?", [req.params.id]);
  res.json(rows);
}));

module.exports = router;
