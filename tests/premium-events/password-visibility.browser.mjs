// Browser regression probe for the local mocked harness only.
// Never import from the application. Use synthetic-only-password as test input.
export function observePasswordToggleTests(output) {
  const results = [];
  let submits = 0;
  const onSubmit = () => { submits++; };
  const onClick = event => {
    const button = event.target.closest('.pe-password-toggle');
    if (!button) return;
    const before = submits;
    setTimeout(() => {
      const input = button.parentElement.querySelector('input');
      const visible = input.type === 'text';
      const result = {
        flow: input.autocomplete === 'new-password' ? 'Create Account' : 'Sign In',
        state: visible ? 'visible' : 'hidden',
        valuePreserved: input.value === 'synthetic-only-password',
        nonSubmitButton: button.type === 'button',
        didNotSubmit: submits === before,
        accessibleLabel: button.getAttribute('aria-label') === (visible ? 'Hide password' : 'Show password'),
      };
      results.push(result);
      output.textContent = JSON.stringify(results);
    }, 0);
  };
  document.addEventListener('submit', onSubmit);
  document.addEventListener('click', onClick);
  return () => { document.removeEventListener('submit', onSubmit); document.removeEventListener('click', onClick); };
}
