import { publicProfileUrl } from './profiles.mjs';

export function accountNavigation(document, { current, publicId } = {}) {
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
  return nav;
}
