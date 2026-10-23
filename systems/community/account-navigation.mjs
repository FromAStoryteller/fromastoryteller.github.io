import {compactAccountNavigation} from '../../account/compact-navigation.mjs';
import { rememberNavigationSnapshot, clearNavigationSnapshot, navigationSnapshot } from '../../account/navigation-shell.mjs';
import { showPendingInvitation } from '../../account/invitation-storage.mjs';
import { publicProfileUrl } from './profiles.mjs';

export function accountNavigation(document, { current, publicId, auth, admin = false, contributor = Boolean(publicId), beforeSignOut } = {}) {
  if (auth) rememberNavigationSnapshot({admin,contributor,publicId});
  else clearNavigationSnapshot();
  if (auth && contributor && !publicId) publicId = navigationSnapshot()?.publicId;
  const nav = document.createElement('nav');
  nav.className = 'account-navigation';
  nav.setAttribute('aria-label', 'Your profile and account');
  for (const [key, label, href] of [
    ['profile', 'Edit my profile', '/account/profile/'],
    ['public', 'View public profile', publicProfileUrl(publicId)],
    ['studio', 'Storyteller Studio', contributor ? '/account/studio/' : null],
    ['saved', 'Saved for later', '/account/saved/'],
    ['favourites', 'Favourites', '/account/favourites/'],
    ['following', 'Following', '/account/following/'],
    ['history', 'Read history', '/account/history/'],
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
  if (admin) {
    const link=document.createElement('a');link.className='account-secondary';link.href='/account/admin/';link.textContent='Admin tools';
    if(current==='admin')link.setAttribute('aria-current','page');nav.append(link);
    nav.classList.add('account-navigation--admin');
  }
  if (auth) {
    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.setAttribute('data-account-sign-out','');
    signOut.className = 'account-secondary';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', async () => {
      if (beforeSignOut && !beforeSignOut()) return;
      signOut.disabled = true;
      signOut.textContent = 'Signing out…';
      try {
        const result = await auth.signOut({ scope: 'local' });
        if (result?.error) throw result.error;
        clearNavigationSnapshot();
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
  if (auth) showPendingInvitation(nav);
  return compactAccountNavigation(nav,{current});
}
