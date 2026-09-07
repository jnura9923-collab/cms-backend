const fetch = require("node-fetch");
require("dotenv").config();

const BASE = process.env.SSLCOMMERZ_IS_LIVE === "true"
  ? "https://securepay.sslcommerz.com"
  : "https://sandbox.sslcommerz.com";

/**
 * Start an SSLCommerz payment session for a fee record.
 * Returns { GatewayPageURL } which the frontend/app redirects the student to.
 * Docs: https://developer.sslcommerz.com/doc/v4/
 */
async function initPayment({ amount, feeId, studentName, studentEmail, studentPhone }) {
  const tranId = `FEE-${feeId}-${Date.now()}`;

  const payload = new URLSearchParams({
    store_id: process.env.SSLCOMMERZ_STORE_ID,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
    total_amount: amount,
    currency: "BDT",
    tran_id: tranId,
    success_url: `${process.env.APP_BASE_URL}/api/fees/payment/ipn`,
    fail_url: `${process.env.FRONTEND_FAIL_URL}`,
    cancel_url: `${process.env.FRONTEND_FAIL_URL}`,
    cus_name: studentName,
    cus_email: studentEmail || "student@cms.com",
    cus_phone: studentPhone || "01700000000",
    cus_add1: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: "Coaching Fee",
    product_category: "Education",
    product_profile: "general",
  });

  const res = await fetch(`${BASE}/gwprocess/v4/api.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload,
  });
  const data = await res.json();

  if (data.status !== "SUCCESS") {
    throw new Error(data.failedreason || "Could not start SSLCommerz session");
  }
  return { gatewayUrl: data.GatewayPageURL, tranId };
}

/** Validate an IPN/callback transaction with SSLCommerz before trusting it. */
async function validateTransaction(valId) {
  const params = new URLSearchParams({
    val_id: valId,
    store_id: process.env.SSLCOMMERZ_STORE_ID,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD,
    format: "json",
  });
  const res = await fetch(`${BASE}/validator/api/validationserverAPI.php?${params.toString()}`);
  const data = await res.json();
  return data.status === "VALID" || data.status === "VALIDATED";
}

module.exports = { initPayment, validateTransaction };
