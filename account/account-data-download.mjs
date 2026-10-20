import { roleLabel } from './roles.mjs';
import { zipFiles } from './export-archive.mjs';

export function accountDataArchive(data) {
  const { user, profile, role } = data.account;
  const text = `From A Storyteller — your account data
Exported: ${data.exported_at}

Email: ${user.email}
Account ID: ${user.id}
Account created: ${user.created_at}
Email verified: ${user.email_confirmed_at ?? 'Not verified'}
Display name: ${profile.display_name}
Welcome line: ${profile.welcome_line || '(empty)'}
Bio: ${profile.bio || '(empty)'}
Public profile ID: ${profile.public_id || '(not assigned)'}
Profile image description: ${profile.image_alt || '(no profile image)'}
Access: ${roleLabel(data.account.roles ?? (role === 'viewer' ? [] : [role]))}
Account state: ${data.account.state}
Profile created: ${profile.created_at}
${data.account.registration ? `
Earlier test declaration:
Type: Local draft acknowledgement (not a live account agreement)
Minimum age self-declared: ${data.account.registration.minimum_age}
Terms version: ${data.account.registration.terms_version}
Privacy notice version: ${data.account.registration.privacy_version}
Recorded: ${data.account.registration.recorded_at}
` : ''}
Published policy agreements:
${data.account.policy_agreements?.length ? data.account.policy_agreements.map(item=>`Terms: ${item.terms_version}\nPrivacy notice: ${item.privacy_version}\nRecorded: ${item.recorded_at}\nTerms SHA-256: ${item.terms_sha256}\nPrivacy SHA-256: ${item.privacy_sha256}`).join('\n\n') : 'No published policy agreement has been recorded.'}

This file contains your current account and profile details. Passwords and session
credentials are excluded. Download your stored profile images, story text and covers\nseparately using your content download in account settings.
Saved content and acknowledgements: ${data.viewer_actions?.length ?? 0}
Private game saves: ${data.game_data?.saves?.length ?? 0}
Your own transient room records: ${data.game_data?.participation?.length ?? 0}
These records are included in metadata/account.json. Other players’ data and room codes are excluded.
metadata/account.json contains the same data in a format suitable for software.
For personal-data questions, contact fromastoryteller@gmail.com.
`;
  const encoder = new TextEncoder();
  return new Blob([zipFiles([
    { name: 'My-account.txt', bytes: encoder.encode(text) },
    { name: 'metadata/account.json', bytes: encoder.encode(JSON.stringify(data, null, 2) + '\n') }
  ])], { type: 'application/zip' });
}
