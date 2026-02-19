/**
 * UTILITY FUNCTIONS
 * Formatting, validation, and helper functions
 */

// ============================================
// MONEY UTILITIES
// ============================================

/**
 * Convert rupees to paisa (for storage)
 * Industry standard: Store money as integers to avoid floating point errors
 *
 * @param {number|string} rupees - Amount in rupees
 * @returns {number} Amount in paisa (integer)
 *
 * @example
 * rupeesToPaisa(100.50) // 10050
 * rupeesToPaisa("50.25") // 5025
 */
export function rupeesToPaisa(rupees) {
  const amount = Number(rupees);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Convert paisa to rupees (for display)
 *
 * @param {number} paisa - Amount in paisa
 * @returns {number} Amount in rupees
 *
 * @example
 * paisaToRupees(10050) // 100.50
 * paisaToRupees(5025) // 50.25
 */
export function paisaToRupees(paisa) {
  const amount = Number(paisa);
  if (isNaN(amount)) return 0;
  return amount / 100;
}

/**
 * Format money for display with currency symbol
 *
 * @param {number} paisa - Amount in paisa
 * @param {boolean} includeCurrency - Whether to include ₹ symbol
 * @returns {string} Formatted money string
 *
 * @example
 * formatMoney(10050) // "₹100.50"
 * formatMoney(10050, false) // "100.50"
 */
export function formatMoney(paisa, includeCurrency = true) {
  const rupees = paisaToRupees(paisa);
  const formatted = rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return includeCurrency ? `₹${formatted}` : formatted;
}

/**
 * Parse money string to paisa
 * Handles various input formats
 *
 * @param {string} moneyString - Money string (e.g., "₹1,000.50", "1000.50")
 * @returns {number} Amount in paisa
 *
 * @example
 * parseMoneyToPaisa("₹1,000.50") // 100050
 * parseMoneyToPaisa("1000.50") // 100050
 */
export function parseMoneyToPaisa(moneyString) {
  if (typeof moneyString === "number") {
    return rupeesToPaisa(moneyString);
  }

  // Remove currency symbols and commas
  const cleaned = String(moneyString).replace(/[₹,\s]/g, "");
  const rupees = parseFloat(cleaned);

  return rupeesToPaisa(rupees);
}

// ============================================
// DATE UTILITIES
// ============================================

/**
 * Format date for display
 *
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale for formatting
 * @returns {string} Formatted date string
 *
 * @example
 * formatDate(new Date()) // "January 1, 2024"
 * formatDate("2024-01-01") // "January 1, 2024"
 */
export function formatDate(date, locale = "en-IN") {
  if (!date) return "";

  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format date for input[type="date"]
 * Returns YYYY-MM-DD format
 *
 * @param {Date|string} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 *
 * @example
 * formatDateForInput(new Date()) // "2024-01-01"
 * formatDateForInput("2024-01-01T00:00:00") // "2024-01-01"
 */
export function formatDateForInput(date) {
  if (!date) return "";

  // If already in YYYY-MM-DD format, return as-is
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Check if date is in the past
 *
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPastDate(date) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d < now;
}

/**
 * Check if date is in the future
 *
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the future
 */
export function isFutureDate(date) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return d > now;
}

/**
 * Get days between two dates
 *
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number} Number of days between dates
 */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Validate email address
 *
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (supports multiple formats)
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone number
 */
export function isValidPhone(phone) {
  const phoneRegex = /^[0-9+\-\s()]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate positive number
 *
 * @param {number|string} value - Value to validate
 * @returns {boolean} True if positive number
 */
export function isPositiveNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

/**
 * Validate non-negative number
 *
 * @param {number|string} value - Value to validate
 * @returns {boolean} True if non-negative number
 */
export function isNonNegativeNumber(value) {
  const num = Number(value);
  return !isNaN(num) && num >= 0;
}

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Truncate string with ellipsis
 *
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 *
 * @example
 * truncate("Hello World", 5) // "Hello..."
 */
export function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
}

/**
 * Capitalize first letter
 *
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 *
 * @example
 * capitalize("hello") // "Hello"
 */
export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Generate initials from name
 *
 * @param {string} name - Full name
 * @returns {string} Initials
 *
 * @example
 * getInitials("John Doe") // "JD"
 */
export function getInitials(name) {
  if (!name) return "";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

// ============================================
// FILE UTILITIES
// ============================================

/**
 * Get file extension
 *
 * @param {string} filename - Filename
 * @returns {string} File extension
 *
 * @example
 * getFileExtension("document.pdf") // "pdf"
 */
export function getFileExtension(filename) {
  if (!filename) return "";
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

/**
 * Check if file is an image
 *
 * @param {string} filename - Filename or URL
 * @returns {boolean} True if image file
 */
export function isImageFile(filename) {
  const ext = getFileExtension(filename);
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

/**
 * Check if file is a PDF
 *
 * @param {string} filename - Filename or URL
 * @returns {boolean} True if PDF file
 */
export function isPdfFile(filename) {
  return getFileExtension(filename) === "pdf";
}

/**
 * Format file size for display
 *
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1048576) // "1 MB"
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// ============================================
// OBJECT UTILITIES
// ============================================

/**
 * Deep clone an object
 *
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 *
 * @param {Object} obj - Object to check
 * @returns {boolean} True if empty
 */
export function isEmpty(obj) {
  if (!obj) return true;
  return Object.keys(obj).length === 0;
}

/**
 * Pick specified keys from object
 *
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to pick
 * @returns {Object} New object with picked keys
 *
 * @example
 * pick({ a: 1, b: 2, c: 3 }, ['a', 'c']) // { a: 1, c: 3 }
 */
export function pick(obj, keys) {
  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
    return result;
  }, {});
}

/**
 * Omit specified keys from object
 *
 * @param {Object} obj - Source object
 * @param {Array} keys - Keys to omit
 * @returns {Object} New object without omitted keys
 *
 * @example
 * omit({ a: 1, b: 2, c: 3 }, ['b']) // { a: 1, c: 3 }
 */
export function omit(obj, keys) {
  const result = { ...obj };
  keys.forEach((key) => delete result[key]);
  return result;
}

// ============================================
// DEBOUNCE & THROTTLE
// ============================================

/**
 * Debounce function - delays execution until after delay
 * Use for: search inputs, resize handlers
 *
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 *
 * @example
 * const debouncedSearch = debounce(search, 300);
 * input.addEventListener('input', debouncedSearch);
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Throttle function - limits execution rate
 * Use for: scroll handlers, mouse move
 *
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between executions
 * @returns {Function} Throttled function
 *
 * @example
 * const throttledScroll = throttle(handleScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
