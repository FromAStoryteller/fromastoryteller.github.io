import { passwordChecks } from './password-policy.mjs';

for (const form of document.querySelectorAll('[data-password-checks]')) {
  const password = form.querySelector('[data-new-password]');
  const confirmation = form.querySelector('[data-confirm-password]');
  const summary = form.querySelector('[data-password-summary]');
  // Design preview only: no submission, network requests, logging or storage.
  form.addEventListener('submit', event => event.preventDefault());
  function update() {
    const checks = passwordChecks(password.value, confirmation.value);
    let met = 0;
    for (const item of form.querySelectorAll('[data-password-rule]')) {
      const satisfied = checks[item.dataset.passwordRule];
      item.dataset.met = String(satisfied);
      item.querySelector('[data-rule-status]').textContent = satisfied ? 'Met' : 'Not met';
      item.querySelector('i').className = satisfied ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle';
      if (item.dataset.passwordRule !== 'match' && satisfied) met++;
    }
    summary.textContent = met === 5 ? 'All password requirements met.' : `${met} of 5 password requirements met.`;
  }
  password.addEventListener('input', update);
  confirmation.addEventListener('input', update);
  update();
}
