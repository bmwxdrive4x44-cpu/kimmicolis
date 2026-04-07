// ═════════════════════════════════════════════════════════
// CORE SANITIZATION & VALIDATION UTILITIES
// ═════════════════════════════════════════════════════════

/**
 * Sanitize and normalize string input
 * - Trims whitespace
 * - Enforces max length
 * - Allows alphanumeric + accents + common punctuation
 */
export function sanitizeString(
  value: string | undefined,
  maxLength: number = 255,
  allowedPattern?: RegExp
): string {
  if (!value) return '';
  const trimmed = String(value).trim();
  const limited = trimmed.slice(0, maxLength);
  // Default: allow letters (with accents), numbers, spaces, hyphens, apostrophes
  const pattern = allowedPattern || /^[a-zA-Z0-9À-ÿ\s\-',.]*$/;
  if (!pattern.test(limited)) {
    return limited.replace(/[^a-zA-Z0-9À-ÿ\s\-',.]/g, '');
  }
  return limited;
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Validate email format
 */
export function validateEmail(email: string | undefined): boolean {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(normalized) && normalized.length <= 255;
}

/**
 * Normalize email (trim, lowercase)
 */
export function normalizeEmail(email: string | undefined): string {
  if (!email) return '';
  return String(email).trim().toLowerCase();
}

/**
 * Validate Algerian phone number (8-15 digits, optional +)
 */
export function validatePhone(phone: string | undefined): boolean {
  if (!phone) return false;
  const normalized = String(phone).trim();
  const pattern = /^\+?[0-9]{8,15}$/;
  return pattern.test(normalized);
}

/**
 * Normalize phone (remove spaces, normalize +)
 */
export function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  return String(phone).trim().replace(/\s+/g, '').replace(/^00/, '+');
}

/**
 * Validate name (first/last name)
 * - 2-50 characters
 * - Letters with accents + hyphens/apostrophes allowed
 */
export function validateName(name: string | undefined): boolean {
  if (!name) return false;
  const trimmed = String(name).trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  const pattern = /^[a-zA-Z\s\-'À-ÿ]+$/;
  return pattern.test(trimmed);
}

/**
 * Sanitize name input
 */
export function sanitizeName(name: string | undefined): string {
  if (!name) return '';
  const trimmed = String(name).trim().slice(0, 50);
  return trimmed.replace(/[^a-zA-Z\s\-'À-ÿ]/g, '');
}

/**
 * Validate password strength
 * - Minimum 6 characters
 * - At least 1 number
 * - At least 1 special char or uppercase
 */
export function validatePassword(password: string | undefined): boolean {
  if (!password) return false;
  const pwd = String(password);
  if (pwd.length < 6 || pwd.length > 255) return false;
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecialOrUppercase = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?A-Z]/.test(pwd);
  return hasNumber && hasSpecialOrUppercase;
}

/**
 * Generic integer validator with min/max bounds
 */
export function validateInteger(
  value: string | number | undefined,
  min: number,
  max: number
): boolean {
  if (value === undefined || value === '') return false;
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num)) return false;
  return num >= min && num <= max;
}

/**
 * Validate decimal number with bounds
 */
export function validateDecimal(
  value: string | number | undefined,
  min: number,
  max: number,
  decimalPlaces: number = 2
): boolean {
  if (value === undefined || value === '') return false;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return false;
  if (num < min || num > max) return false;
  // Check decimal places
  const decimalPart = String(num).split('.')[1];
  if (decimalPart && decimalPart.length > decimalPlaces) return false;
  return true;
}

/**
 * Validate weight in kg (0.1 - 30 kg)
 */
export function validateWeight(weight: string | number | undefined): boolean {
  return validateDecimal(weight, 0.1, 30, 2);
}

/**
 * Validate dimension (length, width, height in cm)
 * Reasonable bounds: 1 - 300 cm
 */
export function validateDimension(value: string | number | undefined): boolean {
  return validateInteger(value, 1, 300);
}

/**
 * Validate address (5-200 chars, basic cleanup)
 */
export function validateAddress(address: string | undefined): boolean {
  if (!address) return false;
  const trimmed = String(address).trim();
  return trimmed.length >= 5 && trimmed.length <= 200;
}

/**
 * Sanitize address input
 */
export function sanitizeAddress(address: string | undefined): string {
  if (!address) return '';
  const trimmed = String(address).trim().slice(0, 200);
  // Allow letters, numbers, spaces, commas, hyphens, periods
  return trimmed.replace(/[^a-zA-Z0-9À-ÿ\s,.\-]/g, '');
}

/**
 * Validate description/text field (max 1000 chars, no XSS)
 */
export function validateDescription(text: string | undefined): boolean {
  if (!text) return true; // descriptions can be optional
  const trimmed = String(text).trim();
  return trimmed.length <= 1000;
}

/**
 * Sanitize description (basic cleanup, max 1000 chars)
 */
export function sanitizeDescription(text: string | undefined): string {
  if (!text) return '';
  const trimmed = String(text).trim().slice(0, 1000);
  // Remove control characters and null bytes
  return trimmed.replace(/[\x00\x1F]/g, '');
}

// ═════════════════════════════════════════════════════════
// DOMAIN-SPECIFIC VALIDATORS (Commerce, Routes, etc)
// ═════════════════════════════════════════════════════════

export function normalizeCommerceRegisterNumber(value: string): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function isAlgerianCommerceRegisterNumber(value: string): boolean {
  const normalized = normalizeCommerceRegisterNumber(value).replace(/\s+/g, '');
  // Format CNRC algérien : [RC-]WW/NNNNNNNLAA
  // WW = code wilaya (2 chiffres), N = séquentiel (1-8 chiffres),
  // L = type activité (1 lettre : B/C/H/R...), AA = année (2 chiffres)
  return /^(RC[\s\-]*)?\d{2}[\/\-]\d{1,8}[A-Z]\d{2}$/.test(normalized);
}

/**
 * Validate vehicle type (string, 3-50 chars)
 */
export function validateVehicleType(vehicle: string | undefined): boolean {
  if (!vehicle) return false;
  const trimmed = String(vehicle).trim();
  return trimmed.length >= 3 && trimmed.length <= 50;
}

/**
 * Validate license plate (6-10 chars, alphanumeric)
 */
export function validateLicensePlate(license: string | undefined): boolean {
  if (!license) return false;
  const trimmed = String(license).trim().toUpperCase();
  const pattern = /^[A-Z0-9]{6,10}$/;
  return pattern.test(trimmed);
}

/**
 * Normalize license plate
 */
export function normalizeLicensePlate(license: string | undefined): string {
  if (!license) return '';
  return String(license).trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Validate future date (for bookings, departures, etc)
 * Returns true if date is strictly in the future
 */
export function validateFutureDate(dateString: string | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  return date.getTime() > Date.now();
}

/**
 * Validate integer range common in UI
 * - Parcel capacity: 1-200
 * - Vehicle seats: 1-8
 * - Delivery time window: 1-48 hours
 */
export function validateCapacity(capacity: string | number | undefined, min: number = 1, max: number = 200): boolean {
  return validateInteger(capacity, min, max);
}
