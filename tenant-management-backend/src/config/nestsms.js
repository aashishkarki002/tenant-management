import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const client = axios.create({
  baseURL: process.env.NESTSMS_BASE_URL || "https://auth.nestsms.com/api/v1/sms",
  headers: {
    "X-API-Key": process.env.NESTSMS_API_KEY,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data;
    const code = data?.code || "UNKNOWN";
    const message = data?.error || err.message;
    const enhanced = new Error(`[NestSMS ${code}] ${message}`);
    enhanced.smsCode = code;
    enhanced.status = err.response?.status;
    enhanced.retryAfter = data?.retry_after ?? null;
    return Promise.reject(enhanced);
  }
);

/**
 * Send SMS to a single recipient.
 *
 * @param {string} to            - Phone number, e.g. "9840123456"
 * @param {string} message       - Message body (max 720 chars text, 335 unicode)
 * @param {"transactional"|"promotional"|"otp"} [messageType]
 * @returns {Promise<{ jobId: string, cost: number, remainingBalance: number }>}
 */
export async function sendSMS(to, message, messageType = "transactional") {
  const senderId = process.env.NESTSMS_SENDER_ID;
  const res = await client.post("/send", {
    to,
    message,
    ...(senderId && { sender_id: senderId }),
    type: "text",
    message_type: messageType,
  });

  const { job_id, cost, remaining_balance } = res.data.data;
  return { jobId: job_id, cost, remainingBalance: remaining_balance };
}

/**
 * Send SMS to multiple recipients (max 1000 per call; auto-batches larger lists).
 *
 * @param {string[]} recipients  - Array of phone numbers
 * @param {string}   message     - Message body
 * @param {"transactional"|"promotional"|"otp"} [messageType]
 * @returns {Promise<{ queuedCount: number, totalCost: number, remainingBalance: number, jobIds: string[] }>}
 */
export async function sendBulkSMS(recipients, message, messageType = "promotional") {
  const senderId = process.env.NESTSMS_SENDER_ID;
  const BATCH_SIZE = 1000;

  const batches = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    batches.push(recipients.slice(i, i + BATCH_SIZE));
  }

  let totalQueued = 0;
  let totalCost = 0;
  let lastBalance = 0;
  const allJobIds = [];

  for (const batch of batches) {
    const res = await client.post("/send", {
      to: batch,
      message,
      ...(senderId && { sender_id: senderId }),
      type: "text",
      message_type: messageType,
    });

    const d = res.data.data;
    totalQueued += d.queued_count ?? 0;
    totalCost += d.total_cost ?? 0;
    lastBalance = d.remaining_balance ?? lastBalance;
    allJobIds.push(...(d.job_ids ?? []));
  }

  return {
    queuedCount: totalQueued,
    totalCost,
    remainingBalance: lastBalance,
    jobIds: allJobIds,
  };
}

/**
 * Get current wallet balance and usage stats.
 *
 * @returns {Promise<{ balance: number, currency: string, perMessageCost: number, messagesRemaining: number, usage: object }>}
 */
export async function checkBalance() {
  const res = await client.get("/balance");
  const d = res.data.data;
  return {
    balance: d.balance,
    currency: d.currency,
    perMessageCost: d.per_message_cost,
    messagesRemaining: d.messages_remaining,
    usage: d.usage,
  };
}

/**
 * Get delivery status of a sent message.
 *
 * @param {string} messageId  - job_id returned from sendSMS / sendBulkSMS
 * @returns {Promise<object>} - Full status object from NestSMS
 */
export async function getMessageStatus(messageId) {
  const res = await client.get(`/status/${messageId}`);
  return res.data.data;
}

/**
 * Fire-and-forget SMS — logs errors but never throws.
 * Use for side-effect SMS where failure must not break the caller.
 *
 * @param {string} to
 * @param {string} message
 * @param {"transactional"|"promotional"|"otp"} [messageType]
 */
export async function sendSMSSafe(to, message, messageType = "transactional") {
  try {
    const result = await sendSMS(to, message, messageType);
    console.log(`[NestSMS] Sent to ${to} — job: ${result.jobId}`);
    return result;
  } catch (err) {
    console.error(`[NestSMS] Failed to send to ${to}: ${err.message}`);
    if (err.smsCode === "INSUFFICIENT_BALANCE") {
      console.warn("[NestSMS] Wallet balance too low — top up required");
    }
    return null;
  }
}
