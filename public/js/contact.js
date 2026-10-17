document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('contact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('contact-alert');
    const payload = {
      name: document.getElementById('c-name').value.trim(),
      email: document.getElementById('c-email').value.trim(),
      phone: document.getElementById('c-phone').value.trim(),
      subject: document.getElementById('c-subject').value.trim(),
      message: document.getElementById('c-message').value.trim()
    };
    try {
      const res = await api.post('/contact', payload);
      alertEl.innerHTML = `<div class="alert alert-success">${res.message}</div>`;
      e.target.reset();
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });

  document.getElementById('find-booking-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ref = document.getElementById('find-ref').value.trim().toUpperCase();
    if (!ref) return;
    window.location.href = `/confirmation.html?ref=${encodeURIComponent(ref)}`;
  });

  document.getElementById('testimonial-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertEl = document.getElementById('testimonial-alert');
    const payload = {
      guestName: document.getElementById('t-name').value.trim(),
      guestCountry: document.getElementById('t-country').value.trim(),
      rating: Number(document.getElementById('t-rating').value),
      message: document.getElementById('t-message').value.trim()
    };
    try {
      const res = await api.post('/testimonials', payload);
      alertEl.innerHTML = `<div class="alert alert-success">${res.message}</div>`;
      e.target.reset();
    } catch (err) {
      alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
});
