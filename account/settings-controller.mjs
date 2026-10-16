import { takeRestoredIdentity } from './session-controller.mjs';

async function verifiedIdentity(client, useRestoredSession = false) {
  const restored = useRestoredSession && takeRestoredIdentity(client.auth);
  if (restored) return restored;
  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data?.session) throw new Error('Your session has ended. Please sign in again.');
  const identity = await client.auth.getUser();
  const user = identity.data?.user;
  if (identity.error || !user?.id || user.is_anonymous) throw new Error('Sign in again to access your account.');
  return user;
}

export async function loadAccount(client, { useRestoredSession = false } = {}) {
  const user = await verifiedIdentity(client, useRestoredSession);
  const [profile, roles, state, declaration, agreements] = await Promise.all([
    client.from('profiles').select('id,display_name,bio,welcome_line,public_id,created_at').eq('id', user.id).single(),
    client.from('user_roles').select('role').eq('user_id', user.id),
    client.rpc('fas_my_account_state'),
    client.rpc('fas_my_registration_declaration'),
    client.rpc('fas_my_policy_agreements'),
  ]);
  if (profile.error || roles.error || state.error || declaration.error || agreements.error || !Array.isArray(agreements.data)) throw new Error('We couldn’t load your account. Please try again.');
  return { user: { id: user.id, email: user.email, created_at: user.created_at, email_confirmed_at: user.email_confirmed_at }, profile: profile.data, role: roles.data[0]?.role ?? 'viewer', state: state.data, registration: declaration.data, policy_agreements: agreements.data };
}

export async function loadProfileAccount(client, { useRestoredSession = false } = {}) {
  const user = await verifiedIdentity(client, useRestoredSession);
  const [profile, roles, state] = await Promise.all([
    client.from('profiles').select('display_name,bio,welcome_line,public_id').eq('id', user.id).single(),
    client.from('user_roles').select('role').eq('user_id', user.id),
    client.rpc('fas_my_account_state'),
  ]);
  if (profile.error || !profile.data || roles.error || state.error) throw new Error('Your profile could not be loaded. Please try again.');
  return { user, profile: profile.data, role: roles.data[0]?.role ?? 'viewer', state: state.data };
}

export async function saveProfile(client, { displayName, bio }) {
  const name = displayName.trim();
  if (!name || [...name].length > 80 || [...bio].length > 1000) throw new Error('Use a display name of 1–80 characters and a bio of up to 1,000 characters.');
  const user = await verifiedIdentity(client);
  const saved = await client.from('profiles').update({ display_name: name, bio }).eq('id', user.id).select('id,display_name,bio,created_at').single();
  if (saved.error) throw new Error('We couldn’t save your profile. Please try again.');
  return saved.data;
}

export async function exportAccountData(client) {
  const account = await loadAccount(client);
  return { format: 'fas-account-data-v3', exported_at: new Date().toISOString(), includes: ['Account details', 'Profile', 'Role', 'Recorded registration declaration, if present', 'Published policy agreements, if present'], excludes: ['Passwords and session credentials', 'Contributor content (available separately)', 'Future game saves and multiplayer data (not implemented)'], account };
}
