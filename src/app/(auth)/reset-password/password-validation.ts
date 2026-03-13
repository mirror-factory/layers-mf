/**
 * Common passwords list — checked case-insensitively against the
 * base word (before any digits/special chars the user appends).
 */
export const COMMON_PASSWORDS = [
  "password",
  "qwerty",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "master",
  "login",
  "princess",
  "football",
  "shadow",
  "sunshine",
  "trustno",
  "iloveyou",
  "batman",
  "access",
  "hello",
  "charlie",
  "donald",
  "admin",
  "qazwsx",
  "abc123",
  "passw0rd",
  "123456",
  "654321",
  "111111",
  "123123",
];

const COMPLEXITY_MSG =
  "Password must include uppercase, lowercase, a number, and a special character.";

/**
 * Validate password strength.
 *
 * Rules:
 *  1. 8–128 characters
 *  2. Must contain uppercase, lowercase, digit, and special character
 *  3. Must not be a common password (case-insensitive prefix match)
 *
 * @returns Error message string, or null if valid.
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be 128 characters or fewer.";

  // Complexity checks
  if (!/[A-Z]/.test(password)) return COMPLEXITY_MSG;
  if (!/[a-z]/.test(password)) return COMPLEXITY_MSG;
  if (!/[0-9]/.test(password)) return COMPLEXITY_MSG;
  if (!/[^A-Za-z0-9]/.test(password)) return COMPLEXITY_MSG;

  // Common password check (case-insensitive)
  const lower = password.toLowerCase();
  for (const common of COMMON_PASSWORDS) {
    if (lower.includes(common)) {
      return "This password is too common. Please choose a more unique password.";
    }
  }

  return null;
}
