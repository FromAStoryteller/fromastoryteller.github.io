import { CHOICE_KEY, readChoice, setChoice, optionalStorageAllowed } from './storage-choice.mjs';
export function initStorageChoices() {
  if (document.querySelector('[data-storage-banner]')) return;
  window.fasOptionalStorageAllowed = optionalStorageAllowed;
  const banner = document.createElement('section');
  banner.className = 'storage-banner'; banner.dataset.storageBanner = '';
  banner.setAttribute('aria-labelledby', 'storage-banner-title');
  banner.innerHTML = `<h2 id="storage-banner-title">Cookies &amp; site storage</h2><p>We use essential storage for account access and to remember this choice. With your permission, we can also remember appearance/sound preferences and game records on this device. We use no analytics or advertising trackers.</p><div class="storage-actions"><button type="button" data-essential>Essential only</button><button type="button" data-allow>Allow optional storage</button><button type="button" data-customise>Choose settings</button></div><p><a href="/privacy/#cookies-analytics">Read about site storage</a></p>`;
  banner.hidden = !!readChoice(); document.body.append(banner);
  const dialog = document.createElement('dialog'); dialog.className = 'storage-dialog'; dialog.setAttribute('aria-labelledby', 'storage-dialog-title');
  dialog.innerHTML = `<h2 id="storage-dialog-title">Your storage choices</h2><p>Essential account storage is used when you sign in. Declining optional storage still lets you browse and play. Your choice itself is remembered for up to 180 days.</p><form method="dialog"><p><strong>Essential — always available</strong><br>Account sessions, security and your storage choice. Sign out to remove the account session from this tab.</p><label><input type="checkbox" name="preferences"> Remember appearance and sound preferences</label><label><input type="checkbox" name="gameRecords"> Remember game records on this device</label><p>Turning a category off removes its existing saved values and stops future saving. Current-page settings and play remain in memory until you leave. This does not delete account/cloud data.</p><p>No analytics or advertising storage is enabled. Future features need a fresh review.</p><div class="storage-actions"><button value="save" type="submit">Save choices</button><button value="cancel" type="submit" formnovalidate>Cancel</button></div></form>`;
  document.body.append(dialog);
  const openButton = document.createElement('button'); openButton.className = 'storage-settings-link'; openButton.type = 'button'; openButton.textContent = 'Storage choices'; document.querySelector('.footer-legal')?.append(openButton);
  function open() { const c = readChoice(); dialog.querySelector('[name=preferences]').checked = !!c?.preferences; dialog.querySelector('[name=gameRecords]').checked = !!c?.gameRecords; dialog.showModal(); }
  function save(c) { setChoice(c); banner.hidden = true; window.dispatchEvent(new Event('fas-storage-choice')); }
  banner.querySelector('[data-essential]').addEventListener('click', () => save({ preferences: false, gameRecords: false }));
  banner.querySelector('[data-allow]').addEventListener('click', () => save({ preferences: true, gameRecords: true }));
  banner.querySelector('[data-customise]').addEventListener('click', open); openButton.addEventListener('click', open);
  dialog.addEventListener('close', () => { if (dialog.returnValue === 'save') save({ preferences: dialog.querySelector('[name=preferences]').checked, gameRecords: dialog.querySelector('[name=gameRecords]').checked }); dialog.returnValue = ''; });
  window.addEventListener('storage', event => { if (event.key === CHOICE_KEY || event.key === null) { banner.hidden = !!readChoice(); window.dispatchEvent(new Event('fas-storage-choice')); } });
}
