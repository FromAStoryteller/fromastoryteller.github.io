// Verified in both FAS hosted Email-provider settings on 15 October 2026.
// Supabase Auth's checkPasswordStrength uses UTF-8 byte length and ContainsAny.
// https://github.com/supabase/auth/blob/master/internal/api/password.go
// https://supabase.com/docs/guides/auth/password-security
export const minimumPasswordLength = 12;
const symbols = '!@#$%^&*()_+-=[]{};\'\\:"|<>?,./`~';
export function passwordChecks(password, confirmation = '') {
  return {
    length: new TextEncoder().encode(password).length >= minimumPasswordLength,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: [...password].some(character => symbols.includes(character)),
    match: password.length > 0 && confirmation.length > 0 && password === confirmation,
  };
}
