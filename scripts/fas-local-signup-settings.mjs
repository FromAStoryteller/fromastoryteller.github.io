export function localSignupReady(config) {
  const section = name => config.match(new RegExp(`^\\[${name.replace('.', '\\.')}\\]\\r?\\n([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, 'm'))?.[1] ?? '';
  const auth = section('auth');
  const email = section('auth.email');
  return /^site_url = "http:\/\/127\.0\.0\.1:55400"$/m.test(auth) &&
    /^minimum_password_length = 12$/m.test(auth) &&
    /^password_requirements = "lower_upper_letters_digits_symbols"$/m.test(auth) &&
    /^enable_signup = true$/m.test(auth) && /^enable_signup = true$/m.test(email) &&
    /^enable_confirmations = true$/m.test(email);
}
