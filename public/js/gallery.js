document.addEventListener('DOMContentLoaded', () => {
  loadGallery('');

  document.querySelectorAll('.gallery-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gallery-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      loadGallery(btn.dataset.category);
    });
  });
});

async function loadGallery(category) {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '<div class="skeleton"></div>'.repeat(8);
  try {
    const query = category ? `?category=${category}` : '';
    const { images } = await api.get(`/gallery${query}`);
    if (!images.length) {
      grid.innerHTML = '<p class="empty-state">No images in this category yet.</p>';
      return;
    }
    grid.innerHTML = images.map((img, i) => `<img class="${i % 5 === 0 ? 'tall' : ''}" src="${img.url}" alt="${img.title || 'Hotel photo'}" loading="lazy" />`).join('');
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}
