const fetch = require("node-fetch");
require("dotenv").config();

/**
 * Generic HTTP SMS sender. Most Bangladeshi SMS providers (BulkSMSBD,
 * SSL Wireless, Alpha SMS, Elitbuzz, etc.) accept a GET/POST request with
 * api_key + sender_id + number + message. Adjust the param names below to
 * match whichever provider you sign up with — the shape rarely changes.
 *
 * For Twilio (international) swap this function body for the `twilio` SDK:
 *   const client = require('twilio')(accountSid, authToken);
 *   await client.messages.create({ to, from: twilioNumber, body: message });
 */
async function sendSMS(number, message) {
  if (!process.env.SMS_API_URL || !process.env.SMS_API_KEY) {
    console.warn(`[sms] SMS gateway not configured — skipped SMS to ${number}: ${message}`);
    return { skipped: true };
  }
  const params = new URLSearchParams({
    api_key: process.env.SMS_API_KEY,
    sender_id: process.env.SMS_SENDER_ID || "CMS",
    number,
    message,
  });
  try {
    const res = await fetch(`${process.env.SMS_API_URL}?${params.toString()}`, { method: "GET" });
    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    console.error("[sms] send failed:", err.message);
    throw err;
  }
}

module.exports = { sendSMS };
