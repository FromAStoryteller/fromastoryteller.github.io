import { publicProfileUrl } from './profiles.mjs';

export function accountNavigation(document, { current, publicId, auth } = {}) {
  const nav = document.createElement('nav');
  nav.className = 'account-navigation';
  nav.setAttribute('aria-label', 'Your profile and account');
  for (const [key, label, href] of [
    ['profile', 'Edit my profile', '/account/profile/'],
    ['public', 'View public profile', publicProfileUrl(publicId)],
    ['settings', 'Account settings', '/account/settings/'],
  ]) {
    if (!href) continue;
    const link = document.createElement('a');
    link.className = 'account-secondary';
    link.href = href;
    link.textContent = label;
    if (key === 'public') link.setAttribute('data-public-link', '');
    if (key === current) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  if (auth) {
    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'account-secondary';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', async () => {
      signOut.disabled = true;
      signOut.textContent = 'Signing out…';
      try {
        const result = await auth.signOut({ scope: 'local' });
        if (result?.error) throw result.error;
        nav.replaceChildren();
        const link = document.createElement('a');
        link.className = 'account-secondary';
        link.href = '/account/sign-in/';
        link.textContent = 'Sign in';
        const status = document.createElement('span');
        status.setAttribute('role', 'status');
        status.textContent = "You're signed out.";
        nav.append(status, link);
      } catch {
        signOut.disabled = false;
        signOut.textContent = 'Could not sign out. Try again';
      }
    });
    nav.append(signOut);
  }
  return nav;
}
