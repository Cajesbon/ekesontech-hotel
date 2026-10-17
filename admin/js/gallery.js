document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  loadGallery();
  document.getElementById('upload-form').addEventListener('submit', uploadImages);
});

async function loadGallery() {
  const grid = document.getElementById('gallery-admin-grid');
  grid.innerHTML = '<div class="skeleton-row" style="height:140px;"></div>'.repeat(6);
  try {
    const { images } = await adminApi.get('/gallery');
    if (!images.length) {
      grid.innerHTML = '<p class="empty-state">No images uploaded yet.</p>';
      return;
    }
    grid.innerHTML = images.map((img) => `
      <div style="position:relative;border-radius:6px;overflow:hidden;border:1px solid var(--stone);">
        <img src="${img.url}" alt="${img.title || ''}" style="width:100%;height:120px;object-fit:cover;display:block;" />
        <div style="padding:8px;font-size:0.75rem;color:var(--text-muted);display:flex;justify-content:space-between;align-items:center;">
          <span>${img.category}</span>
          <button class="btn btn-danger btn-sm" data-delete="${img._id}">Delete</button>
        </div>
      </div>
    `).join('');
    grid.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Delete this image?')) return;
      try {
        await adminApi.del(`/gallery/${btn.dataset.delete}`);
        showToast('Image deleted.', 'success');
        loadGallery();
      } catch (err) { showToast(err.message, 'error'); }
    }));
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

async function uploadImages(e) {
  e.preventDefault();
  const alertEl = document.getElementById('upload-alert');
  const files = document.getElementById('g-images').files;
  if (!files.length) return;

  const formData = new FormData();
  formData.append('title', document.getElementById('g-title').value);
  formData.append('category', document.getElementById('g-category').value);
  Array.from(files).forEach((f) => formData.append('images', f));

  try {
    const res = await fetch('/api/admin/gallery', { method: 'POST', credentials: 'include', body: formData });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error(data.message || 'Upload failed.');
    showToast('Images uploaded.', 'success');
    document.getElementById('upload-form').reset();
    loadGallery();
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
