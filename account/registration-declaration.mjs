// Local draft acknowledgement, not acceptance of a published account agreement.
export const REGISTRATION_VERSION = 'local-preview-2026-10-15-v1';
export function registrationDeclaration({ ageConfirmed, policiesAcknowledged }) {
  if (ageConfirmed !== true || policiesAcknowledged !== true) return null;
  return {
    mode: 'local_draft_review', terms_version: REGISTRATION_VERSION,
    privacy_version: REGISTRATION_VERSION, age_16_or_over: true,
    terms_acknowledged: true, privacy_notice_seen: true,
  };
}
