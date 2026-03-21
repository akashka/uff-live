/**
 * Field validation and format hints for form inputs.
 * Returns true if valid, false if invalid. Empty string is considered "not yet validated".
 */

export type FieldType =
  | 'email'
  | 'phone'
  | 'name'
  | 'required'
  | 'password'
  | 'aadhaar'
  | 'pan'
  | 'pfNumber'
  | 'esiNumber'
  | 'ifsc'
  | 'accountNumber'
  | 'upi'
  | 'date'
  | 'otp'
  | 'number'
  | 'text'
  | 'address'
  | 'bankName';

export function validateField(type: FieldType, value: string): boolean {
  const v = value.trim();
  if (v === '') return true; // Empty = neutral, no error

  switch (type) {
    case 'bankName':
    case 'address':
      return v.length >= 2;
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case 'phone':
      return /^[+]?[\d\s-]{10,15}$/.test(v.replace(/\s/g, '')) && v.replace(/\D/g, '').length >= 10;
    case 'name':
      return v.length >= 2;
    case 'required':
      return v.length > 0;
    case 'password':
      return v.length >= 6;
    case 'aadhaar':
      return /^\d{4}\s?\d{4}\s?\d{4}$|^\d{12}$/.test(v.replace(/\s/g, ''));
    case 'pan':
      return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.toUpperCase());
    case 'pfNumber':
    case 'esiNumber':
      return /^[A-Za-z0-9/-]+$/.test(v) && v.length >= 5;
    case 'ifsc':
      return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()) && v.length === 11;
    case 'accountNumber':
      return /^\d{9,18}$/.test(v);
    case 'upi':
      return /^[\w.-]+@[\w.-]+$/.test(v);
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) || !isNaN(Date.parse(v));
    case 'otp':
      return /^\d{6}$/.test(v);
    case 'number':
      return !isNaN(parseFloat(v)) && parseFloat(v) >= 0;
    default:
      return true;
  }
}

/** Returns 'valid' | 'invalid' | 'neutral'. Neutral when empty and not focused/touched. */
export function getValidationState(type: FieldType, value: string, touched: boolean): 'valid' | 'invalid' | 'neutral' {
  const v = value.trim();
  if (v === '') return touched ? 'invalid' : 'neutral';
  return validateField(type, value) ? 'valid' : 'invalid';
}

export const FIELD_PLACEHOLDERS: Record<FieldType, string> = {
  email: 'e.g. name@example.com',
  phone: 'e.g. +91 9876543210 or 9876543210',
  name: 'e.g. John Doe',
  required: 'Required',
  password: 'Min 6 characters',
  aadhaar: 'e.g. 1234 5678 9012',
  pan: 'e.g. ABCDE1234F',
  pfNumber: 'e.g. KA/BLR/12345',
  esiNumber: 'e.g. 12-34567-89',
  ifsc: 'e.g. SBIN0001234',
  accountNumber: 'e.g. 123456789012',
  upi: 'e.g. name@bank',
  date: 'YYYY-MM-DD',
  otp: '6 digit OTP',
  number: 'e.g. 0 or 100.50',
  text: 'Enter value',
  address: 'e.g. Street, City, Pin',
  bankName: 'e.g. State Bank of India',
};

/** Error/format hints shown below field when invalid. Helps user fix the input. */
export const FIELD_FORMAT_HINTS: Record<FieldType, string> = {
  email: 'Expected: valid email (e.g. name@example.com)',
  phone: 'Expected: 10+ digit phone (e.g. 9876543210)',
  name: 'Expected: at least 2 characters',
  required: 'This field is required',
  password: 'Expected: at least 6 characters',
  aadhaar: 'Expected: 12 digits, with or without spaces (e.g. 1234 5678 9012)',
  pan: 'Expected: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)',
  pfNumber: 'Expected: alphanumeric, min 5 chars (e.g. KA/BLR/12345)',
  esiNumber: 'Expected: alphanumeric with hyphens (e.g. 12-34567-89)',
  ifsc: 'Expected: 11 chars, 4 letters + 0 + 6 alphanumeric (e.g. SBIN0001234)',
  accountNumber: 'Expected: 9–18 digits',
  upi: 'Expected: id@provider (e.g. name@bank)',
  date: 'Expected: YYYY-MM-DD',
  otp: 'Expected: 6 digits',
  number: 'Expected: valid number (e.g. 0 or 100.50)',
  text: 'Enter a value',
  address: 'Expected: at least 2 characters',
  bankName: 'Expected: at least 2 characters',
};
