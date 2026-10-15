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
Bio: ${profile.bio || '(empty)'}
Access: ${({ viewer: 'Viewer', member: 'Contributor', moderator: 'Moderator', admin: 'Administrator' })[role] ?? role}
Account state: ${data.account.state}
Profile created: ${profile.created_at}

This file contains your current account and profile details. Passwords and session
credentials are excluded. Contributors can download stories and images separately.
Future game saves and multiplayer data are not implemented in this preview.
metadata/account.json contains the same data in a format suitable for software.
For personal-data questions, contact fromastoryteller@gmail.com.
`;
  const encoder = new TextEncoder();
  return new Blob([zipFiles([
    { name: 'My-account.txt', bytes: encoder.encode(text) },
    { name: 'metadata/account.json', bytes: encoder.encode(JSON.stringify(data, null, 2) + '\n') }
  ])], { type: 'application/zip' });
}
