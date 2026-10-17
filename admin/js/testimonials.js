document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  loadTestimonials();
  document.getElementById('status-filter').addEventListener('change', loadTestimonials);
  document.getElementById('add-testimonial-btn').addEventListener('click', () => { document.getElementById('testimonial-form').reset(); document.getElementById('testimonial-modal').style.display = 'flex'; });
  document.getElementById('close-testimonial-modal').addEventListener('click', () => { document.getElementById('testimonial-modal').style.display = 'none'; });
  document.getElementById('testimonial-form').addEventListener('submit', addTestimonial);
});

async function loadTestimonials() {
  const body = document.getElementById('testimonials-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="5"></td></tr>'.repeat(3);
  const status = document.getElementById('status-filter').value;
  try {
    const { testimonials } = await adminApi.get(`/testimonials${status ? `?status=${status}` : ''}`);
    if (!testimonials.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-state">No testimonials found.</td></tr>';
      return;
    }
    body.innerHTML = testimonials.map((t) => `
      <tr>
        <td><strong>${t.guestName}</strong><br/><span style="color:var(--text-muted);font-size:0.8rem;">${t.guestCountry || ''}</span></td>
        <td>${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</td>
        <td style="max-width:320px;">${t.message}</td>
        <td>${badgeHtml(t.status)}</td>
        <td class="table-actions">
          ${t.status !== 'approved' ? `<button class="btn btn-outline btn-sm" data-approve="${t._id}">Approve</button>` : ''}
          ${t.status !== 'rejected' ? `<button class="btn btn-outline btn-sm" data-reject="${t._id}">Reject</button>` : ''}
          <button class="btn btn-danger btn-sm" data-delete="${t._id}">Delete</button>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-approve]').forEach((btn) => btn.addEventListener('click', () => setStatus(btn.dataset.approve, 'approved')));
    body.querySelectorAll('[data-reject]').forEach((btn) => btn.addEventListener('click', () => setStatus(btn.dataset.reject, 'rejected')));
    body.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this testimonial?')) return;
      try { await adminApi.del(`/testimonials/${btn.dataset.delete}`); showToast('Deleted.', 'success'); loadTestimonials(); } catch (err) { showToast(err.message, 'error'); }
    }));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="empty-state">${err.message}</td></tr>`;
  }
}

async function setStatus(id, status) {
  try {
    await adminApi.patch(`/testimonials/${id}/status`, { status });
    showToast(`Testimonial ${status}.`, 'success');
    loadTestimonials();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addTestimonial(e) {
  e.preventDefault();
  const alertEl = document.getElementById('testimonial-alert');
  const payload = {
    guestName: document.getElementById('t-name').value.trim(),
    guestCountry: document.getElementById('t-country').value.trim(),
    rating: Number(document.getElementById('t-rating').value),
    message: document.getElementById('t-message').value.trim(),
    status: 'approved'
  };
  try {
    await adminApi.post('/testimonials', payload);
    showToast('Testimonial added.', 'success');
    document.getElementById('testimonial-modal').style.display = 'none';
    loadTestimonials();
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
