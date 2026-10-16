import { passwordChecks } from './password-policy.mjs';
import { LOCAL_ACCOUNT_ORIGIN, PRODUCTION_ACCOUNT_ORIGIN, accountOrigin } from './auth-settings.mjs';
import { registrationDeclaration } from './registration-declaration.mjs';
import { publishedPolicyDeclaration } from './published-policies.mjs';

export const EMAIL_REQUEST_MESSAGE = 'Check your inbox. If this email address can be registered, you’ll receive a verification link. Already have an account? You can sign in instead.';

export function emailRequestError(error) {
  if (error?.message === 'Confirm you are 16 or older and acknowledge the current draft Terms and Privacy notice.') return error.message;
  if (error?.message === 'Confirm your age and agree to the current published Terms after reviewing the Privacy notice.') return error.message;
  if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') return 'Too many email requests. Wait a few minutes, then try again.';
  if (!error?.status || error.status >= 500) return 'We couldn’t connect to account services. Please try again.';
  if (error.code === 'weak_password') return 'Your password does not meet the requirements. Please check the list below.';
  if (error.code === 'email_address_invalid' || error.code === 'validation_failed') return 'Please check your email address and try again.';
  return 'We couldn’t complete your request. Please try again.';
}

export function createSignupController(auth, onChange, origin = LOCAL_ACCOUNT_ORIGIN, requirement = null) {
  const redirectOrigin = accountOrigin(origin);
  if (origin === PRODUCTION_ACCOUNT_ORIGIN && !requirement) throw new Error('Published account policies are not ready.');
  let busy = false;
  return {
    async signUp({ displayName, email, password, confirmation, ageConfirmed, policiesAcknowledged, termsAgreed, privacyNoticeSeen }) {
      if (busy) return;
      const declaration = requirement ? publishedPolicyDeclaration(requirement,{ageConfirmed,termsAgreed,privacyNoticeSeen}) : registrationDeclaration({ ageConfirmed, policiesAcknowledged });
      if (!declaration) return onChange({ state: 'error', message: requirement ? 'Confirm your age, agree to the current Terms and acknowledge the Privacy notice.' : 'Confirm you are 16 or older and acknowledge the draft Terms and Privacy notice before creating a test account.' });
      if (!displayName.trim() || displayName.trim().length > 80 || !Object.values(passwordChecks(password, confirmation)).every(Boolean)) {
        return onChange({ state: 'error', message: 'Enter a display name and make sure both passwords meet the requirements and match.' });
      }
      busy = true;
      onChange({ state: 'pending', message: 'Requesting your verification email…' });
      try {
        const { data, error } = await auth.signUp({ email: email.trim(), password,
          options: { data: { display_name: displayName.trim(), [requirement ? 'fas_policy_agreement' : 'fas_registration']: declaration }, emailRedirectTo: redirectOrigin + '/account/verify-email/' } });
        if (error && error.code !== 'user_already_exists' && error.code !== 'email_exists') return onChange({ state: 'error', message: emailRequestError(error) });
        if (data?.session) {
          await auth.signOut({ scope: 'local' });
          return onChange({ state: 'error', message: 'Email verification is not ready. Please try again later.' });
        }
        onChange({ state: 'requested', message: EMAIL_REQUEST_MESSAGE, email: email.trim() });
      } catch { onChange({ state: 'error', message: emailRequestError({}) }); }
      finally { busy = false; }
    },
  };
}

export async function resendVerification(auth, email, origin = LOCAL_ACCOUNT_ORIGIN) {
  const redirectOrigin = accountOrigin(origin);
  try {
    const { error } = await auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirectOrigin + '/account/verify-email/' } });
    if (error && (error.status === 429 || !error.status || error.status >= 500)) return { state: 'error', message: emailRequestError(error) };
    return { state: 'requested', message: 'If a verification email is needed for this address, you’ll receive a new link. Check your inbox or sign in if your email is already verified.' };
  } catch { return { state: 'error', message: emailRequestError({}) }; }
}
