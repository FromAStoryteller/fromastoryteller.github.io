for (const control of document.querySelectorAll('[data-password-control]')) {
  const input = control.querySelector('input');
  const button = control.querySelector('[data-password-toggle]');
  const label = document.querySelector(`label[for="${input.id}"]`).textContent.toLowerCase();
  button.disabled = input.matches(':disabled');
  button.addEventListener('click', () => {
    if (input.matches(':disabled')) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${label}`);
    button.querySelector('i').className = visible ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    if (start !== null && end !== null) input.setSelectionRange(start, end);
  });
}
