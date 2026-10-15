async function verifiedIdentity(client) {
  const refreshed = await client.auth.refreshSession();
  if (refreshed.error || !refreshed.data?.session) throw new Error('Your session has ended. Please sign in again.');
  const identity = await client.auth.getUser();
  const user = identity.data?.user;
  if (identity.error || !user?.id || user.is_anonymous) throw new Error('Sign in again to access your account.');
  return user;
}

export async function loadAccount(client) {
  const user = await verifiedIdentity(client);
  const profile = await client.from('profiles').select('id,display_name,bio,created_at').eq('id', user.id).single();
  const roles = await client.from('user_roles').select('role').eq('user_id', user.id);
  const state = await client.rpc('fas_my_account_state');
  if (profile.error || roles.error || state.error) throw new Error('We couldn’t load your account. Please try again.');
  return { user: { id: user.id, email: user.email, created_at: user.created_at, email_confirmed_at: user.email_confirmed_at }, profile: profile.data, role: roles.data[0]?.role ?? 'viewer', state: state.data };
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
  return { format: 'fas-account-data-v2', exported_at: new Date().toISOString(), includes: ['Account details', 'Profile', 'Role'], excludes: ['Passwords and session credentials', 'Contributor content (available separately)', 'Future game saves and multiplayer data (not implemented)'], account };
}
