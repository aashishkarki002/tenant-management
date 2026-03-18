// modules/tenant/uploads/upload.service.js
import cloudinary from "../../../config/cloudinary.js";
import { Readable } from "stream";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const UPLOAD_TIMEOUT_MS = 120_000; // 2 min — generous for Nepal→Cloudinary latency
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2_000; // 2s, 4s, 8s exponential backoff

// HTTP codes that are safe to retry (transient errors)
const RETRYABLE_HTTP_CODES = new Set([408, 429, 499, 500, 502, 503, 504]);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function isPdfFile(file) {
  const mime = file.mimetype ?? "";
  const name = file.originalname ?? "";
  return (
    mime === "application/pdf" ||
    mime === "application/x-pdf" ||
    name.toLowerCase().endsWith(".pdf")
  );
}

function bufferToStream(buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

function isRetryableError(err) {
  if (err?.http_code && RETRYABLE_HTTP_CODES.has(err.http_code)) return true;
  const msg = (err?.message ?? "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function redactConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return cfg;
  return {
    cloud_name: cfg.cloud_name,
    api_key: cfg.api_key ? `***${String(cfg.api_key).slice(-4)}` : undefined,
    api_secret: cfg.api_secret ? "***" : undefined,
    secure: cfg.secure,
  };
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ─────────────────────────────────────────────
// CORE: single upload attempt (one Promise)
// ─────────────────────────────────────────────

function _attemptUpload(file, uploadOptions, meta) {
  const { fileName, mimeType, isPdf, fileSizeBytes, startedAt } = meta;

  return new Promise((resolve, reject) => {
    let settled = false;

    // ── Hard timeout watchdog ──────────────────────────────────────────────
    // The Cloudinary SDK's own timeout can misbehave on bad connections.
    // This guarantee-kills the promise if nothing resolves within the window.
    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(
        Object.assign(
          new Error(`Upload timed out after ${UPLOAD_TIMEOUT_MS}ms`),
          { http_code: 499, name: "TimeoutError" },
        ),
      );
    }, UPLOAD_TIMEOUT_MS);

    // ── Cloudinary upload stream ───────────────────────────────────────────
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        clearTimeout(timeoutHandle);
        if (settled) return;
        settled = true;

        const elapsedMs = Date.now() - startedAt;

        if (error) {
          console.error("[Cloudinary] Upload failed:", {
            elapsedMs,
            fileName,
            mimeType,
            isPdf,
            sizeBytes: fileSizeBytes,
            errorName: error?.name,
            errorMessage: error?.message,
            http_code: error?.http_code,
            raw: safeJson(error),
          });
          // Attach http_code so retry logic can inspect it
          const err = new Error(
            `Upload failed (${error?.http_code ?? "no_code"}): ${error?.message ?? "Unknown error"}`,
          );
          err.http_code = error?.http_code;
          return reject(err);
        }

        // ── Success ────────────────────────────────────────────────────────
        // Cloudinary can return a .jpg URL even for PDFs when resource_type="image"
        const url = isPdf
          ? result.secure_url.replace(/\.(jpg|jpeg|png|gif|webp)$/i, ".pdf")
          : result.secure_url;

        console.log(
          `✅ [Cloudinary] Uploaded ${isPdf ? "PDF" : "image"} in ${elapsedMs}ms: ${url}`,
        );

        resolve({
          url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          uploadedAt: new Date(),
        });
      },
    );

    // ── Stream error — reject so the retry loop can catch it ──────────────
    uploadStream.on("error", (err) => {
      clearTimeout(timeoutHandle);
      if (settled) return;
      settled = true;
      console.error("[Cloudinary] uploadStream error event:", {
        fileName,
        errMessage: err?.message,
      });
      reject(err);
    });

    // ── Pipe buffer → upload stream (no disk I/O) ─────────────────────────
    const readable = bufferToStream(file.buffer);
    readable.on("error", (err) => {
      clearTimeout(timeoutHandle);
      if (settled) return;
      settled = true;
      console.error("[Cloudinary] Readable stream error:", {
        fileName,
        errMessage: err?.message,
      });
      reject(err);
    });

    readable.pipe(uploadStream);
  });
}

// ─────────────────────────────────────────────
// PUBLIC: uploadSingleFile (with retry)
// ─────────────────────────────────────────────

/**
 * Upload a single multer file to Cloudinary.
 * Automatically retries on transient network errors (499, timeouts, resets).
 *
 * @param {Express.Multer.File} file
 * @param {{ folder?: string, imageTransform?: object[] }} options
 * @returns {Promise<{ url, publicId, resourceType, format, bytes, uploadedAt }>}
 */
export async function uploadSingleFile(file, options = {}) {
  const {
    folder = "uploads",
    imageTransform = [{ width: 1000, height: 1000, crop: "limit" }],
  } = options;

  const isPdf = isPdfFile(file);
  const fileName = file?.originalname ?? "(unknown)";
  const mimeType = file?.mimetype ?? "(unknown)";
  const fileSizeBytes =
    typeof file?.size === "number"
      ? file.size
      : Buffer.isBuffer(file?.buffer)
        ? file.buffer.length
        : undefined;

  const uploadOptions = {
    folder,
    use_filename: true,
    unique_filename: true,
    ...(isPdf
      ? {
          resource_type: "image", // NOT "raw" — needed for PDF preview support
          format: "pdf",
          flags: "attachment",
        }
      : {
          resource_type: "image",
          transformation: imageTransform,
        }),
  };

  // Log once before retries start
  console.log("[Cloudinary] Preparing upload:", {
    fileName,
    mimeType,
    isPdf,
    sizeKB:
      typeof fileSizeBytes === "number"
        ? Math.round((fileSizeBytes / 1024) * 100) / 100
        : undefined,
    folder,
    cloudinaryConfig: redactConfig(
      typeof cloudinary?.config === "function" ? cloudinary.config() : null,
    ),
  });

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startedAt = Date.now();
    const meta = { fileName, mimeType, isPdf, fileSizeBytes, startedAt };

    try {
      return await _attemptUpload(file, uploadOptions, meta);
    } catch (err) {
      lastError = err;

      const shouldRetry = isRetryableError(err) && attempt < MAX_RETRIES;

      if (!shouldRetry) {
        console.error(
          `[Cloudinary] Giving up on "${fileName}" after ${attempt} attempt(s): ${err.message}`,
        );
        throw err;
      }

      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1); // 2s, 4s, 8s
      console.warn(
        `[Cloudinary] Attempt ${attempt}/${MAX_RETRIES} failed for "${fileName}" ` +
          `(${err.message}). Retrying in ${delay}ms...`,
      );
      await sleep(delay);
    }
  }

  throw lastError; // unreachable but satisfies linters
}

// ─────────────────────────────────────────────
// PUBLIC: uploadFiles (batch)
// ─────────────────────────────────────────────

/**
 * Upload multiple files in parallel.
 * Throws if ANY file fails — the caller (tenant service) is responsible
 * for deciding whether to abort the transaction or accept partial uploads.
 *
 * @param {Express.Multer.File[]} files
 * @param {{ folder?: string, imageTransform?: object[] }} options
 * @returns {Promise<Array<{ url, publicId, resourceType, format, bytes, uploadedAt }>>}
 */
export async function uploadFiles(files, options = {}) {
  if (!files || files.length === 0) return [];

  const results = await Promise.allSettled(
    files.map((file) => uploadSingleFile(file, options)),
  );

  const failures = results
    .map((r, i) => ({ result: r, file: files[i] }))
    .filter(({ result }) => result.status === "rejected");

  if (failures.length > 0) {
    const summary = failures
      .map(
        ({ file, result }) =>
          `"${file.originalname}": ${result.reason?.message}`,
      )
      .join(" | ");

    throw new Error(
      `${failures.length} of ${files.length} upload(s) failed — ${summary}`,
    );
  }

  return results.map((r) => r.value);
}
