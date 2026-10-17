/* Attaches show/hide behavior to every .password-toggle-btn on the page. */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.password-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.toggleFor);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      btn.classList.toggle('active', !showing);
    });
  });
});
