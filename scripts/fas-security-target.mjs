// No caller-supplied URL or project reference: hosted tests target FAS dev only.
export const FAS_DEV_REF = 'oqmmvjjycpyxvxipcyli';
export function securityTarget(args, confirmation) {
  if (args.length === 0 && confirmation === 'fas-community-v1') {
    return { base: 'http://127.0.0.1:55321', name: 'LOCAL FAS', hosted: false };
  }
  if (args.length === 1 && args[0] === '--hosted-dev'
      && confirmation === `fas-community-dev:${FAS_DEV_REF}`) {
    return { base: `https://${FAS_DEV_REF}.supabase.co`, name: 'HOSTED FAS DEVELOPMENT', hosted: true };
  }
  throw new Error('Security tests require the exact local or FAS development acknowledgement. Arbitrary targets are forbidden. See docs/backend/security.md.');
}
export function checkLegacyProjectKey(key, role) {
  if (key.split('.').length !== 3) return; // Modern keys are bound by the fixed endpoint.
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url'));
  if (claims.role !== role || claims.ref !== FAS_DEV_REF) {
    throw new Error('Hosted tests require a key for the expected role and FAS development reference.');
  }
}
